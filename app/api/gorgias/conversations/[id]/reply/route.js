import { getUserFromToken } from '../../../../../../lib/supabaseAdmin'
import { getGorgiasCredentials } from '../../../../../../lib/gorgiasCredentials'
import { NextResponse } from 'next/server'

const VALID_CHANNELS = ['email', 'chat', 'facebook', 'instagram', 'sms', 'api']

function stripUnsafeHtml(html = '') {
  return String(html)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '')
}

export async function POST(request, { params }) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const creds = await getGorgiasCredentials(user.id)
  if (!creds) return NextResponse.json({ error: 'Gorgias not connected' }, { status: 400 })

  const { id } = await params
  const { body, channel } = await request.json()
  const ticketId = parseInt(id, 10)
  const messageChannel = channel || 'email'

  if (!body?.trim()) {
    return NextResponse.json({ error: 'Message body is required' }, { status: 400 })
  }
  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    return NextResponse.json({ error: 'Invalid ticket id' }, { status: 400 })
  }
  if (!VALID_CHANNELS.includes(messageChannel)) {
    return NextResponse.json({ error: 'Invalid channel' }, { status: 400 })
  }

  const safeBody = stripUnsafeHtml(body)

  const res = await fetch(`${creds.baseUrl}/tickets/${id}/messages`, {
    method: 'POST',
    headers: { 'Authorization': creds.authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      body_html: safeBody,
      body_text: safeBody.replace(/<[^>]+>/g, ''),
      channel: messageChannel,
      from_agent: true,
      ticket: { id: ticketId },
      sender: { email: creds.email },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return NextResponse.json({ error: err.error || 'Failed to send reply' }, { status: 502 })
  }

  const message = await res.json()
  return NextResponse.json({ success: true, messageId: message.id })
}
