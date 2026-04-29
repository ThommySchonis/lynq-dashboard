import { supabaseAdmin, getUserFromToken } from '../../../../../lib/supabaseAdmin'
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

// GET — fetch all messages in a conversation (full thread history)
export async function GET(request, { params }) {
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

  if (!outlookToken) return NextResponse.json({ error: 'Outlook not connected' }, { status: 400 })

  let accessToken = outlookToken.access_token
  if (new Date(outlookToken.expires_at) < new Date()) {
    accessToken = await refreshOutlookToken(user.id, outlookToken.refresh_token)
    if (!accessToken) return NextResponse.json({ error: 'Token refresh failed' }, { status: 401 })
  }

  const { id } = await params
  const safeConversationId = String(id || '').replace(/'/g, "''")

  // Fetch all messages in this conversation, oldest first
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages?$filter=conversationId eq '${safeConversationId}'&$orderby=receivedDateTime asc&$top=50&$select=id,subject,from,toRecipients,receivedDateTime,body,bodyPreview,isRead,conversationId`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  const data = await res.json()
  if (!res.ok) return NextResponse.json({ error: data.error?.message || 'Failed to fetch thread' }, { status: 502 })

  const messages = (data.value || []).map(msg => ({
    id: msg.id,
    threadId: msg.conversationId,
    from: msg.from?.emailAddress ? `${msg.from.emailAddress.name} <${msg.from.emailAddress.address}>` : '',
    to: (msg.toRecipients || []).map(r => r.emailAddress?.address).join(', '),
    subject: msg.subject || '(no subject)',
    date: msg.receivedDateTime,
    body: msg.body?.content || msg.bodyPreview || '',
    snippet: msg.bodyPreview || '',
    unread: !msg.isRead,
  }))

  return NextResponse.json({ messages, threadId: id })
}

// PATCH — mark entire conversation as read
export async function PATCH(request, { params }) {
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

  if (!outlookToken) return NextResponse.json({ error: 'Outlook not connected' }, { status: 400 })

  let accessToken = outlookToken.access_token
  if (new Date(outlookToken.expires_at) < new Date()) {
    accessToken = await refreshOutlookToken(user.id, outlookToken.refresh_token)
    if (!accessToken) return NextResponse.json({ error: 'Token refresh failed' }, { status: 401 })
  }

  const { id } = await params
  const safeConversationId = String(id || '').replace(/'/g, "''")

  // Get unread message IDs in this conversation, then mark each as read
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages?$filter=conversationId eq '${safeConversationId}' and isRead eq false&$select=id`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const data = await res.json()
  const unreadIds = (data.value || []).map(m => m.id)

  await Promise.all(unreadIds.map(msgId =>
    fetch(`https://graph.microsoft.com/v1.0/me/messages/${msgId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRead: true }),
    })
  ))

  return NextResponse.json({ success: true })
}
