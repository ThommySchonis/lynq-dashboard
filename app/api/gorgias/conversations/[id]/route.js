import { getUserFromToken } from '../../../../../lib/supabaseAdmin'
import { getGorgiasCredentials } from '../../../../../lib/gorgiasCredentials'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const creds = await getGorgiasCredentials(user.id)
  if (!creds) return NextResponse.json({ error: 'Gorgias not connected' }, { status: 400 })

  const { id } = await params

  const [ticketRes, messagesRes] = await Promise.all([
    fetch(`${creds.baseUrl}/tickets/${id}`, {
      headers: { 'Authorization': creds.authHeader, 'Content-Type': 'application/json' },
    }),
    fetch(`${creds.baseUrl}/tickets/${id}/messages?order_by=created_datetime:asc&limit=50`, {
      headers: { 'Authorization': creds.authHeader, 'Content-Type': 'application/json' },
    }),
  ])

  if (!ticketRes.ok) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  const ticket = await ticketRes.json()
  const messagesData = messagesRes.ok ? await messagesRes.json() : { data: [] }

  const messages = (messagesData.data || []).map(m => ({
    id: m.id,
    body: m.body_html || m.body_text,
    bodyText: m.body_text,
    from: m.from_agent
      ? { name: `${m.sender?.firstname || ''} ${m.sender?.lastname || ''}`.trim(), isAgent: true }
      : { name: ticket.customer?.email || 'Customer', isAgent: false },
    createdAt: m.created_datetime,
    channel: m.channel,
    attachments: (m.attachments || []).map(a => ({ name: a.name, url: a.url })),
  }))

  return NextResponse.json({
    id: ticket.id,
    subject: ticket.subject,
    status: ticket.status,
    customer: ticket.customer ? {
      name: `${ticket.customer.firstname || ''} ${ticket.customer.lastname || ''}`.trim() || ticket.customer.email,
      email: ticket.customer.email,
    } : null,
    messages,
    createdAt: ticket.created_datetime,
    updatedAt: ticket.updated_datetime,
  })
}
