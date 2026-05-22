import { supabaseAdmin } from './supabaseAdmin'
import { getAdapter } from './providers'
import { getStoreCredentials } from './store-credentials'
import { checkTicketLimit, lockWorkspace } from './services/limit-check'
import { recordOutboundMessage } from './services/billing'
import { parseJson } from './utils/typed-json'
import { trackEvent } from '@/lib/analytics/track'
import { EVENT_TYPES } from '@/lib/analytics/events'

const UPGRADE_URL = '/settings/workspace/billing'

// ── Types ────────────────────────────────────────────────────────────────────

interface EmailAddress {
  email: string
  name?: string
}

interface NormalizedMessage {
  providerMessageId: string
  messageId?: string
  from: EmailAddress
  to: EmailAddress[]
  cc?: EmailAddress[]
  subject?: string
  bodyHtml?: string
  bodyText?: string
  date?: string
  isOutbound: boolean
}

interface Thread {
  providerThreadId: string
  subject: string
  snippet: string
  lastMessageAt: string
  messages: NormalizedMessage[]
}

interface MessageConversationRef {
  conversation_id: string
}

interface MessageIdRow {
  message_id?: string
}

interface ShopifyCustomerSearchResponse {
  customers?: Array<{ id: number | string }>
}

interface EmailAccountRow {
  id: string
  client_id?: string
  workspace_id: string
  provider: string
  email_address?: string
  display_name?: string
  last_sync_at?: string | null
  store_id?: string | null
  [key: string]: unknown
}

interface ConversationRow {
  id: string
  workspace_id: string
  email_account_id: string
  subject: string | null
  snippet: string
  customer_email: string
  customer_name: string
  status: string
  provider_thread_id: string
  shopify_customer_id: string | null
  last_message_at: string
  message_count: number
  is_unread: boolean
  last_outbound_at?: string | null
  [key: string]: unknown
}

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

  const results: Array<{ accountId: string; error?: string; newConversations?: number; updatedConversations?: number }> = []
  for (const account of accounts) {
    try {
      const result = await syncAccount(account as EmailAccountRow, workspaceId)
      results.push({ accountId: (account as EmailAccountRow).id, ...result })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`Sync failed for account ${(account as EmailAccountRow).id}:`, message)
      results.push({ accountId: (account as EmailAccountRow).id, error: message })
    }
  }

  return { synced: results.length, results }
}

async function syncAccount(account: EmailAccountRow, workspaceId: string) {
  const adapter = getAdapter(account.provider)
  const refreshedAccount = await adapter.refreshTokenIfNeeded(account)

  const fetchResult = await adapter.fetchThreads(refreshedAccount, {
    since: account.last_sync_at || undefined,
  })
  const threads = fetchResult.threads as Thread[]

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
  const result = await supabaseAdmin
    .from('email_conversations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('provider_thread_id', providerThreadId)
    .maybeSingle()
  return result.data as ConversationRow | null
}

async function createConversation(thread: Thread, account: EmailAccountRow, workspaceId: string) {
  const inboundMsg = thread.messages.find((m) => !m.isOutbound) || thread.messages[0]
  const customerEmail = inboundMsg?.isOutbound ? inboundMsg.to[0]?.email : inboundMsg?.from?.email
  const customerName = inboundMsg?.isOutbound ? inboundMsg.to[0]?.name : inboundMsg?.from?.name

  const shopifyCustomerId = await matchShopifyCustomer(account.store_id || null, workspaceId, customerEmail)

  const insertResult = await supabaseAdmin
    .from('email_conversations')
    .insert({
      client_id: account.client_id,
      workspace_id: workspaceId,
      email_account_id: account.id,
      store_id: account.store_id || null,
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

  if (insertResult.error) {
    console.error('[engine] createConversation error:', insertResult.error.message, insertResult.error.details)
  }

  const conversation = insertResult.data as ConversationRow | null
  if (conversation) {
    await insertMessages(conversation.id, workspaceId, thread.messages)
    void trackEvent(workspaceId, EVENT_TYPES.TICKET_OPENED, conversation.id, account.provider)
  }

  return conversation
}

async function updateConversationWithNewMessages(conversation: ConversationRow, thread: Thread, workspaceId: string) {
  const { data: existingMessages } = await supabaseAdmin
    .from('email_messages')
    .select('provider_message_id')
    .eq('conversation_id', conversation.id)

  const existingIds = new Set(
    (existingMessages || []).map((m: { provider_message_id: string }) => m.provider_message_id)
  )
  const newMessages = thread.messages.filter((m) => !existingIds.has(m.providerMessageId))

  if (newMessages.length === 0) return

  await insertMessages(conversation.id, workspaceId, newMessages)

  const hasNewInbound = newMessages.some((m) => !m.isOutbound)
  const updates: Record<string, unknown> = {
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

async function insertMessages(conversationId: string, workspaceId: string, messages: NormalizedMessage[]) {
  const rows = messages.map((m) => ({
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

export async function processInboundMessage(account: EmailAccountRow, normalizedMessage: NormalizedMessage) {
  const workspaceId = account.workspace_id

  let conversation: ConversationRow | null = null

  // 1. Try to find existing conversation via in-reply-to message_id
  if (normalizedMessage.messageId) {
    const { data: relatedMsg } = await supabaseAdmin
      .from('email_messages')
      .select('conversation_id')
      .eq('message_id', normalizedMessage.messageId)
      .maybeSingle()

    if (relatedMsg) {
      const convResult = await supabaseAdmin
        .from('email_conversations')
        .select('*')
        .eq('id', (relatedMsg as MessageConversationRef).conversation_id)
        .single()
      conversation = convResult.data as ConversationRow | null
    }
  }

  // 2. Fall back: match by sender email + similar subject
  if (!conversation) {
    const fallbackResult = await supabaseAdmin
      .from('email_conversations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('customer_email', normalizedMessage.from.email)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const row = fallbackResult.data as ConversationRow | null
    if (row && row.subject && normalizedMessage.subject?.includes(row.subject.replace(/^Re:\s*/i, ''))) {
      conversation = row
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
    void trackEvent(workspaceId, EVENT_TYPES.MESSAGE_RECEIVED, conversation.id, account.provider)

    const updates: Record<string, unknown> = {
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
    const shopifyCustomerId = await matchShopifyCustomer(account.store_id || null, workspaceId, normalizedMessage.from.email)

    const newConvResult = await supabaseAdmin
      .from('email_conversations')
      .insert({
        workspace_id: workspaceId,
        email_account_id: account.id,
        store_id: account.store_id || null,
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
        reactivated_from: shouldReactivateAsNew ? conversation!.id : null,
      })
      .select()
      .single()

    const newConv = newConvResult.data as ConversationRow | null
    if (newConv) {
      await insertMessages(newConv.id, workspaceId, [normalizedMessage])
      void trackEvent(workspaceId, EVENT_TYPES.TICKET_OPENED, newConv.id, account.provider)
      void trackEvent(workspaceId, EVENT_TYPES.MESSAGE_RECEIVED, newConv.id, account.provider)
    }
  }
}

// ---------------------------------------------------------------------------
// Send reply
// ---------------------------------------------------------------------------

interface SendReplyParams {
  to: EmailAddress[]
  cc: EmailAddress[]
  bcc: EmailAddress[]
  subject: string
  bodyHtml: string
  bodyText: string
}

export async function sendReply(workspaceId: string, conversationId: string, _userEmail: string, { to, cc, bcc, subject, bodyHtml, bodyText }: SendReplyParams, memberId?: string | null) {
  const limitCheck = await checkTicketLimit(workspaceId)
  if (!limitCheck.allowed) {
    // Flip the workspace flag so banners + composers can render the
    // locked state without re-querying the limit on every render.
    // lockWorkspace is idempotent — safe to call on every blocked attempt.
    await lockWorkspace(workspaceId)
    return planLimitErrorResponse(limitCheck)
  }

  const convQueryResult = await supabaseAdmin
    .from('email_conversations')
    .select('*, email_accounts(*)')
    .eq('id', conversationId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!convQueryResult.data) throw new Error('Conversation not found')

  const convRow = convQueryResult.data as ConversationRow & { email_accounts: EmailAccountRow }
  const account = convRow.email_accounts
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

  const lastMsgRow = lastMsg as MessageIdRow | null

  const adapter = getAdapter(account.provider)
  const refreshedAccount = await adapter.refreshTokenIfNeeded(account)

  const result = await adapter.sendReply(refreshedAccount, {
    to: to || [{ email: convRow.customer_email, name: convRow.customer_name }],
    cc,
    bcc,
    subject: subject || `Re: ${convRow.subject}`,
    bodyHtml,
    bodyText,
    inReplyTo: lastMsgRow?.message_id || '',
    references: lastMsgRow?.message_id || '',
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
      to_email: to?.[0]?.email || convRow.customer_email,
      to_name: to?.[0]?.name || convRow.customer_name,
      cc: cc || [],
      bcc: bcc || [],
      subject: subject || `Re: ${convRow.subject}`,
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
      message_count: (convRow.message_count || 0) + 1,
    })
    .eq('id', conversationId)

  void trackEvent(workspaceId, EVENT_TYPES.MESSAGE_SENT, conversationId, account.provider, memberId)

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

export async function sendNewEmail(workspaceId: string, _userEmail: string, accountId: string, { to, cc, bcc, subject, bodyHtml, bodyText }: SendReplyParams, memberId?: string | null) {
  const limitCheck = await checkTicketLimit(workspaceId)
  if (!limitCheck.allowed) {
    await lockWorkspace(workspaceId)
    return planLimitErrorResponse(limitCheck)
  }

  const accountResult = await supabaseAdmin
    .from('email_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!accountResult.data) throw new Error('Email account not found')

  const accountRow = accountResult.data as EmailAccountRow
  const adapter = getAdapter(accountRow.provider)
  const refreshedAccount = await adapter.refreshTokenIfNeeded(accountRow)

  const result = await adapter.sendNew(refreshedAccount, {
    to, cc, bcc, subject, bodyHtml, bodyText,
  })

  const shopifyCustomerId = await matchShopifyCustomer(accountRow.store_id || null, workspaceId, to[0]?.email)

  const newConvInsertResult = await supabaseAdmin
    .from('email_conversations')
    .insert({
      workspace_id: workspaceId,
      email_account_id: accountRow.id,
      store_id: accountRow.store_id || null,
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

  const conversation = newConvInsertResult.data as ConversationRow | null
  if (conversation) {
    await supabaseAdmin
      .from('email_messages')
      .insert({
        conversation_id: conversation.id,
        workspace_id: workspaceId,
        provider_message_id: result.providerMessageId,
        message_id: result.messageId,
        from_email: accountRow.email_address,
        from_name: accountRow.display_name || '',
        to_email: to[0]?.email || '',
        to_name: to[0]?.name || '',
        cc: cc || [],
        bcc: bcc || [],
        subject,
        body_html: bodyHtml,
        body_text: bodyText,
        is_outbound: true,
      })
    void trackEvent(workspaceId, EVENT_TYPES.TICKET_OPENED, conversation.id, accountRow.provider, memberId)
    void trackEvent(workspaceId, EVENT_TYPES.MESSAGE_SENT, conversation.id, accountRow.provider, memberId)
  }

  // Count this conversation against the workspace's ticket counter
  // (this is a brand-new conversation, so counted_in_usage_period is
  // null and the helper will count via the 'first_outbound' branch).
  const convRow = conversation
  const billing = convRow?.id
    ? await recordOutboundMessage(workspaceId, convRow.id)
    : null

  return { success: true, conversationId: convRow?.id, billing }
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

export async function linkCustomer(workspaceId: string, conversationId: string, shopifyCustomerId: string | number) {
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

async function matchShopifyCustomer(storeId: string | null, workspaceId: string, email: string | undefined | null) {
  if (!storeId || !email) return null

  try {
    const { domain, accessToken } = await getStoreCredentials(storeId, workspaceId)

    const res = await fetch(
      `https://${domain}/admin/api/2025-04/customers/search.json?query=email:${encodeURIComponent(email)}`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!res.ok) return null
    const data = await parseJson<ShopifyCustomerSearchResponse>(res)

    if (data.customers && data.customers.length > 0) {
      return String(data.customers[0].id)
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Shopify customer match failed:', message)
  }

  return null
}

// Exported for inbox service
export { updateConversationStatus as resolveThread }
