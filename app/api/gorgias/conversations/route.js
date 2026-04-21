import { getUserFromToken } from '../../../../lib/supabaseAdmin'
import { getGorgiasCredentials } from '../../../../lib/gorgiasCredentials'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const creds = await getGorgiasCredentials(user.id)
  if (!creds) return NextResponse.json({ error: 'Gorgias not connected' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'open'
  const page = searchParams.get('page') || 1

  const res = await fetch(
    `${creds.baseUrl}/tickets?order_by=updated_datetime:desc&limit=20&page=${page}&status=${status}`,
    { headers: { 'Authorization': creds.authHeader, 'Content-Type': 'application/json' } }
  )

  if (!res.ok) return NextResponse.json({ error: 'Gorgias API error' }, { status: 502 })

  const data = await res.json()

  const conversations = (data.data || []).map(t => ({
    id: t.id,
    subject: t.subject,
    status: t.status,
    channel: t.channel,
    customer: t.customer ? {
      name: `${t.customer.firstname || ''} ${t.customer.lastname || ''}`.trim() || t.customer.email,
      email: t.customer.email,
    } : null,
    lastMessage: t.last_message_datetime,
    updatedAt: t.updated_datetime,
    messagesCount: t.messages_count,
    isUnread: t.is_unread,
    assignee: t.assignee_user ? `${t.assignee_user.firstname} ${t.assignee_user.lastname}`.trim() : null,
  }))

  return NextResponse.json({
    conversations,
    total: data.meta?.total_count || 0,
    hasMore: !!data.meta?.next_cursor,
  })
}
