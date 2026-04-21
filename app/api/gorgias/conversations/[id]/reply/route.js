import { getUserFromToken } from '../../../../../../lib/supabaseAdmin'
import { getGorgiasCredentials } from '../../../../../../lib/gorgiasCredentials'
import { NextResponse } from 'next/server'

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

  if (!body?.trim()) {
    return NextResponse.json({ error: 'Message body is required' }, { status: 400 })
  }

  const res = await fetch(`${creds.baseUrl}/tickets/${id}/messages`, {
    method: 'POST',
    headers: { 'Authorization': creds.authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      body_html: body,
      body_text: body.replace(/<[^>]+>/g, ''),
      channel: channel || 'email',
      from_agent: true,
      ticket: { id: parseInt(id) },
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
