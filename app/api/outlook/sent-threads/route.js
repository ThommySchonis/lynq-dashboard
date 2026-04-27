import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

async function refreshOutlookToken(userId, refreshToken) {
  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) return null
  await supabaseAdmin.from('outlook_tokens').update({
    access_token: data.access_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }).eq('user_id', userId)
  return data.access_token
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: outlookToken } = await supabaseAdmin
    .from('outlook_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!outlookToken) return NextResponse.json({ threads: [], connected: false })

  let accessToken = outlookToken.access_token
  if (new Date(outlookToken.expires_at) < new Date()) {
    accessToken = await refreshOutlookToken(user.id, outlookToken.refresh_token)
    if (!accessToken) return NextResponse.json({ threads: [], connected: false })
  }

  const res = await fetch(
    'https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages?$top=30&$orderby=sentDateTime desc&$select=id,subject,from,toRecipients,sentDateTime,bodyPreview,conversationId',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const data = await res.json()
  if (!res.ok) return NextResponse.json({ threads: [], connected: true })

  const threads = (data.value || []).map(msg => ({
    id: msg.conversationId || msg.id,
    subject: msg.subject || '(no subject)',
    from: msg.from?.emailAddress ? `${msg.from.emailAddress.name} <${msg.from.emailAddress.address}>` : '',
    to: (msg.toRecipients || []).map(r => r.emailAddress?.address).join(', '),
    date: msg.sentDateTime,
    snippet: msg.bodyPreview || '',
    unread: false,
    isSent: true,
  }))

  return NextResponse.json({ threads, connected: true, email: outlookToken.email })
}
