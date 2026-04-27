import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

async function refreshAccessToken(userId, refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID?.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET?.trim(),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) return null
  await supabaseAdmin.from('gmail_tokens').update({
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

  const { data: gmailToken } = await supabaseAdmin
    .from('gmail_tokens')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!gmailToken) return NextResponse.json({ threads: [], connected: false })

  let accessToken = gmailToken.access_token
  if (new Date(gmailToken.expires_at) < new Date()) {
    accessToken = await refreshAccessToken(user.id, gmailToken.refresh_token)
    if (!accessToken) return NextResponse.json({ threads: [], connected: false })
  }

  // Fetch from SENT label
  const listRes = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/threads?labelIds=SENT&maxResults=30',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const listData = await listRes.json()
  if (!listData.threads) return NextResponse.json({ threads: [], connected: true })

  const threads = await Promise.all(
    listData.threads.slice(0, 30).map(async t => {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const data = await res.json()
      const msg = data.messages?.[data.messages.length - 1]
      const headers = msg?.payload?.headers || []
      const get = name => headers.find(h => h.name === name)?.value || ''

      return {
        id: t.id,
        subject: get('Subject') || '(no subject)',
        from: get('From'),
        to: get('To'),
        date: get('Date'),
        snippet: msg?.snippet || '',
        unread: false,
        isSent: true,
      }
    })
  )

  return NextResponse.json({ threads, connected: true, email: gmailToken.email })
}
