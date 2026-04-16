import { supabaseAdmin, getUserFromToken } from '../../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

function decodeBase64(str) {
  if (!str) return ''
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  try {
    return Buffer.from(base64, 'base64').toString('utf-8')
  } catch {
    return ''
  }
}

function extractBody(payload) {
  if (!payload) return ''

  // Direct body
  if (payload.body?.data) {
    return decodeBase64(payload.body.data)
  }

  // Multipart: prefer text/plain, fallback to text/html
  if (payload.parts) {
    const plain = payload.parts.find(p => p.mimeType === 'text/plain')
    if (plain?.body?.data) return decodeBase64(plain.body.data)

    const html = payload.parts.find(p => p.mimeType === 'text/html')
    if (html?.body?.data) return decodeBase64(html.body.data)

    // Nested multipart
    for (const part of payload.parts) {
      const nested = extractBody(part)
      if (nested) return nested
    }
  }

  return ''
}

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

export async function GET(request, { params }) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: gmailToken } = await supabaseAdmin
    .from('gmail_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!gmailToken) return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 })

  let accessToken = gmailToken.access_token
  if (new Date(gmailToken.expires_at) < new Date()) {
    accessToken = await refreshAccessToken(user.id, gmailToken.refresh_token)
    if (!accessToken) return NextResponse.json({ error: 'Token refresh failed' }, { status: 401 })
  }

  const { id } = await params

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${id}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const data = await res.json()

  if (!res.ok) return NextResponse.json({ error: data.error?.message || 'Failed to fetch thread' }, { status: 502 })

  const messages = (data.messages || []).map(msg => {
    const headers = msg.payload?.headers || []
    const get = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''

    return {
      id: msg.id,
      threadId: msg.threadId,
      from: get('From'),
      to: get('To'),
      subject: get('Subject'),
      date: get('Date'),
      body: extractBody(msg.payload),
      snippet: msg.snippet || '',
      labelIds: msg.labelIds || [],
      unread: msg.labelIds?.includes('UNREAD'),
    }
  })

  return NextResponse.json({ messages, threadId: id })
}

// Mark thread as read
export async function PATCH(request, { params }) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: gmailToken } = await supabaseAdmin
    .from('gmail_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!gmailToken) return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 })

  let accessToken = gmailToken.access_token
  if (new Date(gmailToken.expires_at) < new Date()) {
    accessToken = await refreshAccessToken(user.id, gmailToken.refresh_token)
    if (!accessToken) return NextResponse.json({ error: 'Token refresh failed' }, { status: 401 })
  }

  const { id } = await params

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${id}/modify`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
    }
  )

  if (!res.ok) return NextResponse.json({ error: 'Failed to mark as read' }, { status: 502 })
  return NextResponse.json({ success: true })
}
