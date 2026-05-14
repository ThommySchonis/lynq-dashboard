import { supabaseAdmin } from './supabaseAdmin'
import { getAdapter } from './providers'
import { checkTicketLimit, lockWorkspace } from './services/limit-check'
import { recordOutboundMessage } from './services/billing'

const UPGRADE_URL = '/settings/workspace/billing'

function planLimitErrorResponse(check: { used: number; limit: number | null; planId: string }) {
  return {
    error:        'PLAN_LIMIT_REACHED',
    code:         'PLAN_LIMIT_REACHED',
    resource:     'tickets' as const,
    current_plan: check.planId,
    used:         check.used,
    limit:        check.limit,
    upgrade_url:  UPGRADE_URL,
  }
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

export async function syncAllAccounts(workspaceId: string) {
  const { data: accounts } = await supabaseAdmin
    .from('email_accounts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')

  if (!accounts?.length) return { synced: 0 }

  const results: any[] = []
  for (const account of accounts) {
    try {
      const result = await syncAccount(account, workspaceId)
      results.push({ accountId: account.id, ...result })
    } catch (err: any) {
      console.error(`Sync failed for account ${account.id}:`, err.message)
      results.push({ accountId: account.id, error: err.message })
    }
  }

  return { synced: results.length, results }
}

async function syncAccount(account: any, workspaceId: string) {
  const adapter = getAdapter(account.provider)
  const refreshedAccount = await adapter.refreshTokenIfNeeded(account)

  const { threads } = await adapter.fetchThreads(refreshedAccount, {
    since: account.last_sync_at || undefined,
  })

  let newConversations = 0
  let updatedConversations = 0

  for (const thread of threads) {
    const existing = await findConversationByThreadId(workspaceId, thread.providerThreadId)

    if (existing) {
      await updateConversationWithNewMessages(existing, thread, workspaceId)
      updatedConversations++
    } else {
      await createConversation(thread, account, workspaceId)
      newConversations++
    }
  }

  // Only update last_sync_at if we actually found threads (or if this was a first sync with no filter)
  if (threads.length > 0 || account.last_sync_at) {
    await supabaseAdmin
      .from('email_accounts')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', account.id)
  }

  return { newConversations, updatedConversations }
}

async function findConversationByThreadId(workspaceId: string, providerThreadId: string) {
  const { data } = await supabaseAdmin
    .from('email_conversations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('provider_thread_id', providerThreadId)
    .maybeSingle()
  return data
}

async function createConversation(thread: any, account: any, workspaceId: string) {
  const inboundMsg = thread.messages.find((m: any) => !m.isOutbound) || thread.messages[0]
  const customerEmail = inboundMsg?.isOutbound ? inboundMsg.to[0]?.email : inboundMsg?.from?.email
  const customerName = inboundMsg?.isOutbound ? inboundMsg.to[0]?.name : inboundMsg?.from?.name

  const shopifyCustomerId = await matchShopifyCustomer(workspaceId, customerEmail)

  const { data: conversation, error: convError } = await supabaseAdmin
    .from('email_conversations')
    .insert({
      client_id: account.client_id,
      workspace_id: workspaceId,
      email_account_id: account.id,
      subject: thread.subject,
      snippet: thread.snippet,
      customer_email: customerEmail || '',
      customer_name: customerName || '',
      status: 'open',
      provider_thread_id: thread.providerThreadId,
      shopify_customer_id: shopifyCustomerId,
      last_message_at: thread.lastMessageAt,
      message_count: thread.messages.length,
      is_unread: true,
    })
    .select()
    .single()

  if (convError) {
    console.error('[engine] createConversation error:', convError.message, convError.details)
  }

  if (conversation) {
    await insertMessages(conversation.id, workspaceId, thread.messages)
  }

  return conversation
}

async function updateConversationWithNewMessages(conversation: any, thread: any, workspaceId: string) {
  const { data: existingMessages } = await supabaseAdmin
    .from('email_messages')
    .select('provider_message_id')
    .eq('conversation_id', conversation.id)

  const existingIds = new Set((existingMessages || []).map((m: any) => m.provider_message_id))
  const newMessages = thread.messages.filter((m: any) => !existingIds.has(m.providerMessageId))

  if (newMessages.length === 0) return

  await insertMessages(conversation.id, workspaceId, newMessages)

  const hasNewInbound = newMessages.some((m: any) => !m.isOutbound)
  const updates: any = {
    last_message_at: thread.lastMessageAt,
    snippet: thread.snippet,
    message_count: conversation.message_count + newMessages.length,
  }

  if (hasNewInbound && ['resolved', 'closed', 'pending'].includes(conversation.status)) {
    updates.status = 'open'
    updates.is_unread = true
  }

  await supabaseAdmin
    .from('email_conversations')
    .update(updates)
    .eq('id', conversation.id)
}

async function insertMessages(conversationId: string, workspaceId: string, messages: any[]) {
  const rows = messages.map((m: any) => ({
    conversation_id: conversationId,
    workspace_id: workspaceId,
    provider_message_id: m.providerMessageId,
    message_id: m.messageId,
    from_email: m.from.email,
    from_name: m.from.name,
    to_email: m.to[0]?.email || '',
    to_name: m.to[0]?.name || '',
    cc: m.cc || [],
    bcc: [],
    subject: m.subject,
    body_html: m.bodyHtml,
    body_text: m.bodyText,
    is_outbound: m.isOutbound,
    created_at: m.date,
  }))

  // Insert one-by-one to handle duplicate key errors (partial unique index on provider_message_id)
  for (const row of rows) {
    const { error } = await supabaseAdmin.from('email_messages').insert(row)
    if (error && !error.message.includes('duplicate key')) throw error
  }
}

// ---------------------------------------------------------------------------
// Inbound webhook processing
// ---------------------------------------------------------------------------

export async function processInboundMessage(account: any, normalizedMessage: any) {
  const workspaceId = account.workspace_id

  let conversation: any = null

  // 1. Try to find existing conversation via in-reply-to message_id
  if (normalizedMessage.messageId) {
    const { data: relatedMsg } = await supabaseAdmin
      .from('email_messages')
      .select('conversation_id')
      .eq('message_id', normalizedMessage.messageId)
      .maybeSingle()

    if (relatedMsg) {
      const { data } = await supabaseAdmin
        .from('email_conversations')
        .select('*')
        .eq('id', relatedMsg.conversation_id)
        .single()
      conversation = data
    }
  }

  // 2. Fall back: match by sender email + similar subject
  if (!conversation) {
    const { data } = await supabaseAdmin
      .from('email_conversations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('customer_email', normalizedMessage.from.email)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data && data.subject && normalizedMessage.subject?.includes(data.subject.replace(/^Re:\s*/i, ''))) {
      conversation = data
    }
  }

  // 10-day reactivation rule:
  //   - Match on a 'closed' or 'resolved' conversation
  //   - Customer's inbound arrived > 10 days after the last outbound
  //   → don't reopen; create a NEW conversation row instead so the
  //     next agent reply counts as a fresh billable ticket.
  //
  // Within 10 days, or for any other status, fall through to the
  // existing "reopen + append message" behavior.
  const REACTIVATION_THRESHOLD_MS = 10 * 24 * 60 * 60 * 1000
  const shouldReactivateAsNew = (() => {
    if (!conversation) return false
    if (!['closed', 'resolved'].includes(conversation.status)) return false
    if (!conversation.last_outbound_at) return false  // never had an outbound; safe to reopen
    const lastOut = new Date(conversation.last_outbound_at).getTime()
    return Date.now() - lastOut > REACTIVATION_THRESHOLD_MS
  })()

  if (conversation && !shouldReactivateAsNew) {
    await insertMessages(conversation.id, workspaceId, [normalizedMessage])

    const updates: any = {
      last_message_at: normalizedMessage.date || new Date().toISOString(),
      snippet: normalizedMessage.bodyText?.substring(0, 100) || '',
      message_count: (conversation.message_count || 0) + 1,
      is_unread: true,
    }

    // Reopen resolved/closed/pending conversations on new inbound
    if (['resolved', 'closed', 'pending'].includes(conversation.status)) {
      updates.status = 'open'
    }

    await supabaseAdmin
      .from('email_conversations')
      .update(updates)
      .eq('id', conversation.id)
  } else {
    // Two paths land here:
    //   (a) No prior conversation matched the inbound → fresh conversation.
    //   (b) Prior conversation matched but it was closed/resolved and the
    //       10-day reactivation window has lapsed → new conversation row
    //       linked back via reactivated_from for analytics.
    const shopifyCustomerId = await matchShopifyCustomer(workspaceId, normalizedMessage.from.email)

    const { data: newConv } = await supabaseAdmin
      .from('email_conversations')
      .insert({
        workspace_id: workspaceId,
        email_account_id: account.id,
        subject: normalizedMessage.subject || '(no subject)',
        snippet: normalizedMessage.bodyText?.substring(0, 100) || '',
        customer_email: normalizedMessage.from.email,
        customer_name: normalizedMessage.from.name,
        status: 'open',
        provider_thread_id: normalizedMessage.providerMessageId || normalizedMessage.messageId || `inbound_${Date.now()}`,
        shopify_customer_id: shopifyCustomerId,
        last_message_at: normalizedMessage.date || new Date().toISOString(),
        message_count: 1,
        is_unread: true,
        // Attribution: if we got here via the 10-day reactivation rule,
        // record which prior conversation this one descends from.
        reactivated_from: shouldReactivateAsNew ? conversation.id : null,
      })
      .select()
      .single()

    if (newConv) {
      await insertMessages(newConv.id, workspaceId, [normalizedMessage])
    }
  }
}

// ---------------------------------------------------------------------------
// Send reply
// ---------------------------------------------------------------------------

export async function sendReply(workspaceId: string, conversationId: string, userEmail: string, { to, cc, bcc, subject, bodyHtml, bodyText }: { to: any; cc: any; bcc: any; subject: any; bodyHtml: any; bodyText: any }) {
  const limitCheck = await checkTicketLimit(workspaceId)
  if (!limitCheck.allowed) {
    // Flip the workspace flag so banners + composers can render the
    // locked state without re-querying the limit on every render.
    // lockWorkspace is idempotent — safe to call on every blocked attempt.
    await lockWorkspace(workspaceId)
    return planLimitErrorResponse(limitCheck)
  }

  const { data: conversation } = await supabaseAdmin
    .from('email_conversations')
    .select('*, email_accounts(*)')
    .eq('id', conversationId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!conversation) throw new Error('Conversation not found')

  const account = (conversation as any).email_accounts
  if (!account) throw new Error('Email account not found for this conversation')

  // Fetch last inbound message for threading headers
  const { data: lastMsg } = await supabaseAdmin
    .from('email_messages')
    .select('message_id')
    .eq('conversation_id', conversationId)
    .eq('is_outbound', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const adapter = getAdapter(account.provider)
  const refreshedAccount = await adapter.refreshTokenIfNeeded(account)

  const result = await adapter.sendReply(refreshedAccount, {
    to: to || [{ email: (conversation as any).customer_email, name: (conversation as any).customer_name }],
    cc,
    bcc,
    subject: subject || `Re: ${(conversation as any).subject}`,
    bodyHtml,
    bodyText,
    inReplyTo: (lastMsg as any)?.message_id || '',
    references: (lastMsg as any)?.message_id || '',
  })

  await supabaseAdmin
    .from('email_messages')
    .insert({
      conversation_id: conversationId,
      workspace_id: workspaceId,
      provider_message_id: result.providerMessageId,
      message_id: result.messageId,
      from_email: account.email_address,
      from_name: account.display_name || '',
      to_email: to?.[0]?.email || (conversation as any).customer_email,
      to_name: to?.[0]?.name || (conversation as any).customer_name,
      cc: cc || [],
      bcc: bcc || [],
      subject: subject || `Re: ${(conversation as any).subject}`,
      body_html: bodyHtml,
      body_text: bodyText,
      is_outbound: true,
    })

  // Reply sent → status becomes pending (awaiting customer response).
  // NB: when the inbox UI uses "Send & Close", the client follows up
  // with a separate updateStatus('resolved') call after handleSend()
  // resolves. We keep the "pending" default here to preserve that flow.
  await supabaseAdmin
    .from('email_conversations')
    .update({
      status: 'pending',
      last_message_at: new Date().toISOString(),
      message_count: ((conversation as any).message_count || 0) + 1,
    })
    .eq('id', conversationId)

  // Records this outbound against the workspace's ticket counter, with
  // the spam-aware + count-once-per-conversation rules from PR 3.
  const billing = await recordOutboundMessage(workspaceId, conversationId)

  return {
    success: true,
    billing,
  }
}

// ---------------------------------------------------------------------------
// Send new email (outbound, creates a new conversation)
// ---------------------------------------------------------------------------

export async function sendNewEmail(workspaceId: string, userEmail: string, accountId: string, { to, cc, bcc, subject, bodyHtml, bodyText }: { to: any; cc: any; bcc: any; subject: any; bodyHtml: any; bodyText: any }) {
  const limitCheck = await checkTicketLimit(workspaceId)
  if (!limitCheck.allowed) {
    await lockWorkspace(workspaceId)
    return planLimitErrorResponse(limitCheck)
  }

  const { data: account } = await supabaseAdmin
    .from('email_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!account) throw new Error('Email account not found')

  const adapter = getAdapter((account as any).provider)
  const refreshedAccount = await adapter.refreshTokenIfNeeded(account)

  const result = await adapter.sendNew(refreshedAccount, {
    to, cc, bcc, subject, bodyHtml, bodyText,
  })

  const shopifyCustomerId = await matchShopifyCustomer(workspaceId, to[0]?.email)

  const { data: conversation } = await supabaseAdmin
    .from('email_conversations')
    .insert({
      workspace_id: workspaceId,
      email_account_id: (account as any).id,
      subject,
      snippet: bodyText?.substring(0, 100) || '',
      customer_email: to[0]?.email || '',
      customer_name: to[0]?.name || '',
      status: 'pending',
      provider_thread_id: result.providerMessageId,
      shopify_customer_id: shopifyCustomerId,
      last_message_at: new Date().toISOString(),
      message_count: 1,
      is_unread: false,
    })
    .select()
    .single()

  if (conversation) {
    await supabaseAdmin
      .from('email_messages')
      .insert({
        conversation_id: conversation.id,
        workspace_id: workspaceId,
        provider_message_id: result.providerMessageId,
        message_id: result.messageId,
        from_email: (account as any).email_address,
        from_name: (account as any).display_name || '',
        to_email: to[0]?.email || '',
        to_name: to[0]?.name || '',
        cc: cc || [],
        bcc: bcc || [],
        subject,
        body_html: bodyHtml,
        body_text: bodyText,
        is_outbound: true,
      })
  }

  // Count this conversation against the workspace's ticket counter
  // (this is a brand-new conversation, so counted_in_usage_period is
  // null and the helper will count via the 'first_outbound' branch).
  const billing = conversation?.id
    ? await recordOutboundMessage(workspaceId, conversation.id)
    : null

  return { success: true, conversationId: conversation?.id, billing }
}

// ---------------------------------------------------------------------------
// Status management
// ---------------------------------------------------------------------------

export async function updateConversationStatus(workspaceId: string, conversationId: string, status: string) {
  const validStatuses = ['open', 'pending', 'resolved', 'closed']
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}`)
  }

  await supabaseAdmin
    .from('email_conversations')
    .update({ status })
    .eq('id', conversationId)
    .eq('workspace_id', workspaceId)

  return { success: true }
}

// ---------------------------------------------------------------------------
// Shopify customer linking
// ---------------------------------------------------------------------------

export async function linkCustomer(workspaceId: string, conversationId: string, shopifyCustomerId: any) {
  await supabaseAdmin
    .from('email_conversations')
    .update({ shopify_customer_id: shopifyCustomerId })
    .eq('id', conversationId)
    .eq('workspace_id', workspaceId)

  return { success: true }
}

// ---------------------------------------------------------------------------
// Internal: Shopify customer lookup by email
// ---------------------------------------------------------------------------

async function matchShopifyCustomer(workspaceId: string, email: any) {
  if (!email) return null

  try {
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('shopify_domain, shopify_api_key')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (!(client as any)?.shopify_domain || !(client as any)?.shopify_api_key) return null

    const res = await fetch(
      `https://${(client as any).shopify_domain}/admin/api/2024-01/customers/search.json?query=email:${encodeURIComponent(email)}`,
      {
        headers: {
          'X-Shopify-Access-Token': (client as any).shopify_api_key,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!res.ok) return null
    const data = await res.json()

    if (data.customers?.length > 0) {
      return String(data.customers[0].id)
    }
  } catch (err: any) {
    console.error('Shopify customer match failed:', err.message)
  }

  return null
}
