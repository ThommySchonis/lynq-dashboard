import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
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
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Look up Gmail token by Supabase user ID (not email)
  const { data: gmailToken } = await supabaseAdmin
    .from('gmail_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!gmailToken) return NextResponse.json({ error: 'Gmail not connected', connected: false }, { status: 200 })

  // Refresh token if expired
  let accessToken = gmailToken.access_token
  if (new Date(gmailToken.expires_at) < new Date()) {
    accessToken = await refreshAccessToken(user.id, gmailToken.refresh_token)
    if (!accessToken) return NextResponse.json({ error: 'Token refresh failed', connected: false }, { status: 200 })
  }

  const { searchParams } = new URL(request.url)
  const maxResults = searchParams.get('limit') || 20
  const pageToken = searchParams.get('pageToken') || ''

  const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/threads')
  listUrl.searchParams.set('maxResults', maxResults)
  listUrl.searchParams.set('q', 'in:inbox')
  if (pageToken) listUrl.searchParams.set('pageToken', pageToken)

  const listRes = await fetch(listUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const listData = await listRes.json()

  if (!listData.threads) return NextResponse.json({ threads: [], connected: true })

  const threads = await Promise.all(
    listData.threads.slice(0, 20).map(async (t) => {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const data = await res.json()
      const msg = data.messages?.[data.messages.length - 1]
      const headers = msg?.payload?.headers || []
      const get = (name) => headers.find(h => h.name === name)?.value || ''

      return {
        id: t.id,
        subject: get('Subject') || '(no subject)',
        from: get('From'),
        to: get('To'),
        date: get('Date'),
        snippet: data.messages?.[0]?.snippet || '',
        unread: msg?.labelIds?.includes('UNREAD'),
        messageCount: data.messages?.length || 1,
        latestMessageId: msg?.id,
      }
    })
  )

  return NextResponse.json({
    connected: true,
    gmail_address: gmailToken.gmail_address,
    threads,
    nextPageToken: listData.nextPageToken || null,
  })
}
