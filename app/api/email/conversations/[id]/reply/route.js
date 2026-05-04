import { supabaseAdmin } from '../../../../../../lib/supabaseAdmin'
import { getAuthContext } from '../../../../../../lib/auth'
import { checkEmailLimit, incrementEmailCount } from '../../../../../../lib/emailUsage'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limitCheck = await checkEmailLimit(ctx.user.email)
  if (!limitCheck.allowed) {
    return NextResponse.json({
      error: 'Email limit reached',
      code:  'EMAIL_LIMIT_REACHED',
      used:  limitCheck.used,
      limit: limitCheck.limit,
      plan:  limitCheck.plan,
    }, { status: 429 })
  }

  const { id } = await params
  const { body } = await request.json()
  if (!body?.trim()) return NextResponse.json({ error: 'Message is required' }, { status: 400 })

  // Get conversation + email account (workspace-scoped). Both lookups
  // must succeed before we send anything via Resend.
  const [{ data: conversation }, { data: account }] = await Promise.all([
    supabaseAdmin.from('email_conversations').select('*').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle(),
    supabaseAdmin.from('email_accounts').select('*').eq('workspace_id', ctx.workspaceId).maybeSingle(),
  ])

  if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  if (!account)      return NextResponse.json({ error: 'Email not connected' }, { status: 400 })

  // Get last inbound message for threading
  const { data: lastMessage } = await supabaseAdmin
    .from('email_messages')
    .select('message_id')
    .eq('conversation_id', id)
    .eq('is_outbound', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Send via Resend as the client's real email
  const { data: sent, error: sendError } = await resend.emails.send({
    from:    `${account.display_name} <${account.real_email}>`,
    to:      [conversation.customer_email],
    subject: conversation.subject.startsWith('Re:') ? conversation.subject : `Re: ${conversation.subject}`,
    html:    body,
    headers: lastMessage?.message_id
      ? { 'In-Reply-To': lastMessage.message_id, 'References': lastMessage.message_id }
      : undefined,
  })

  if (sendError) {
    return NextResponse.json({ error: sendError.message }, { status: 502 })
  }

  await incrementEmailCount(ctx.user.email)

  // Save outbound message. email_messages has workspace_id (no client_id
  // column on this table — checked in Phase 0 column inspection).
  await supabaseAdmin.from('email_messages').insert({
    conversation_id: id,
    workspace_id:    ctx.workspaceId,
    from_email:      account.real_email,
    from_name:       account.display_name,
    body_html:       body,
    body_text:       body.replace(/<[^>]+>/g, ''),
    is_outbound:     true,
    message_id:      sent?.id,
  })

  await supabaseAdmin
    .from('email_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)

  return NextResponse.json({ success: true })
}
