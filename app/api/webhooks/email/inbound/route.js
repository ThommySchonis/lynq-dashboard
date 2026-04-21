import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const payload = await request.json()

  // Resend sends parsed email fields
  const to = payload.to?.[0]?.email || payload.to
  const fromEmail = payload.from?.email || payload.from
  const fromName = payload.from?.name || fromEmail
  const subject = payload.subject || '(no subject)'
  const bodyHtml = payload.html || payload.text || ''
  const bodyText = payload.text || ''
  const messageId = payload.headers?.['message-id'] || payload.message_id
  const inReplyTo = payload.headers?.['in-reply-to'] || payload.in_reply_to

  if (!to) return NextResponse.json({ ok: true })

  // Find client by forwarding address
  const { data: account } = await supabaseAdmin
    .from('email_accounts')
    .select('client_id, real_email, display_name')
    .eq('forwarding_address', to)
    .maybeSingle()

  if (!account) return NextResponse.json({ ok: true })

  // Find or create conversation by in-reply-to or subject + customer
  let conversationId = null

  if (inReplyTo) {
    const { data: existing } = await supabaseAdmin
      .from('email_messages')
      .select('conversation_id')
      .eq('message_id', inReplyTo)
      .maybeSingle()
    if (existing) conversationId = existing.conversation_id
  }

  if (!conversationId) {
    const { data: conv } = await supabaseAdmin
      .from('email_conversations')
      .insert({
        client_id: account.client_id,
        subject,
        customer_email: fromEmail,
        customer_name: fromName,
        status: 'open',
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    conversationId = conv.id
  } else {
    await supabaseAdmin
      .from('email_conversations')
      .update({ status: 'open', last_message_at: new Date().toISOString() })
      .eq('id', conversationId)
  }

  await supabaseAdmin.from('email_messages').insert({
    conversation_id: conversationId,
    from_email: fromEmail,
    from_name: fromName,
    body_html: bodyHtml,
    body_text: bodyText,
    is_outbound: false,
    message_id: messageId,
    in_reply_to: inReplyTo,
  })

  return NextResponse.json({ ok: true })
}
