import { supabaseAdmin } from './supabaseAdmin'
import { getAdapter } from './providers'
import { checkEmailLimit, incrementEmailCount } from './emailUsage'

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

export async function syncAllAccounts(workspaceId) {
  const { data: accounts } = await supabaseAdmin
    .from('email_accounts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')

  if (!accounts?.length) return { synced: 0 }

  const results = []
  for (const account of accounts) {
    try {
      const result = await syncAccount(account, workspaceId)
      results.push({ accountId: account.id, ...result })
    } catch (err) {
      console.error(`Sync failed for account ${account.id}:`, err.message)
      results.push({ accountId: account.id, error: err.message })
    }
  }

  return { synced: results.length, results }
}

async function syncAccount(account, workspaceId) {
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

async function findConversationByThreadId(workspaceId, providerThreadId) {
  const { data } = await supabaseAdmin
    .from('email_conversations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('provider_thread_id', providerThreadId)
    .maybeSingle()
  return data
}

async function createConversation(thread, account, workspaceId) {
  const inboundMsg = thread.messages.find(m => !m.isOutbound) || thread.messages[0]
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

async function updateConversationWithNewMessages(conversation, thread, workspaceId) {
  const { data: existingMessages } = await supabaseAdmin
    .from('email_messages')
    .select('provider_message_id')
    .eq('conversation_id', conversation.id)

  const existingIds = new Set((existingMessages || []).map(m => m.provider_message_id))
  const newMessages = thread.messages.filter(m => !existingIds.has(m.providerMessageId))

  if (newMessages.length === 0) return

  await insertMessages(conversation.id, workspaceId, newMessages)

  const hasNewInbound = newMessages.some(m => !m.isOutbound)
  const updates = {
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

async function insertMessages(conversationId, workspaceId, messages) {
  const rows = messages.map(m => ({
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

export async function processInboundMessage(account, normalizedMessage) {
  const workspaceId = account.workspace_id

  let conversation = null

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

  if (conversation) {
    await insertMessages(conversation.id, workspaceId, [normalizedMessage])

    const updates = {
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
    // New conversation
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

export async function sendReply(workspaceId, conversationId, userEmail, { to, cc, bcc, subject, bodyHtml, bodyText }) {
  const limitCheck = await checkEmailLimit(userEmail)
  if (!limitCheck.allowed) {
    return {
      error: 'Email limit reached',
      code: 'EMAIL_LIMIT_REACHED',
      used: limitCheck.used,
      limit: limitCheck.limit,
      plan: limitCheck.plan,
    }
  }

  const { data: conversation } = await supabaseAdmin
    .from('email_conversations')
    .select('*, email_accounts(*)')
    .eq('id', conversationId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!conversation) throw new Error('Conversation not found')

  const account = conversation.email_accounts
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
    to: to || [{ email: conversation.customer_email, name: conversation.customer_name }],
    cc,
    bcc,
    subject: subject || `Re: ${conversation.subject}`,
    bodyHtml,
    bodyText,
    inReplyTo: lastMsg?.message_id || '',
    references: lastMsg?.message_id || '',
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
      to_email: to?.[0]?.email || conversation.customer_email,
      to_name: to?.[0]?.name || conversation.customer_name,
      cc: cc || [],
      bcc: bcc || [],
      subject: subject || `Re: ${conversation.subject}`,
      body_html: bodyHtml,
      body_text: bodyText,
      is_outbound: true,
    })

  // Reply sent → status becomes pending (awaiting customer response)
  await supabaseAdmin
    .from('email_conversations')
    .update({
      status: 'pending',
      last_message_at: new Date().toISOString(),
      message_count: (conversation.message_count || 0) + 1,
    })
    .eq('id', conversationId)

  await incrementEmailCount(userEmail)

  return { success: true }
}

// ---------------------------------------------------------------------------
// Send new email (outbound, creates a new conversation)
// ---------------------------------------------------------------------------

export async function sendNewEmail(workspaceId, userEmail, accountId, { to, cc, bcc, subject, bodyHtml, bodyText }) {
  const limitCheck = await checkEmailLimit(userEmail)
  if (!limitCheck.allowed) {
    return {
      error: 'Email limit reached',
      code: 'EMAIL_LIMIT_REACHED',
      used: limitCheck.used,
      limit: limitCheck.limit,
      plan: limitCheck.plan,
    }
  }

  const { data: account } = await supabaseAdmin
    .from('email_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!account) throw new Error('Email account not found')

  const adapter = getAdapter(account.provider)
  const refreshedAccount = await adapter.refreshTokenIfNeeded(account)

  const result = await adapter.sendNew(refreshedAccount, {
    to, cc, bcc, subject, bodyHtml, bodyText,
  })

  const shopifyCustomerId = await matchShopifyCustomer(workspaceId, to[0]?.email)

  const { data: conversation } = await supabaseAdmin
    .from('email_conversations')
    .insert({
      workspace_id: workspaceId,
      email_account_id: account.id,
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
        from_email: account.email_address,
        from_name: account.display_name || '',
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

  await incrementEmailCount(userEmail)

  return { success: true, conversationId: conversation?.id }
}

// ---------------------------------------------------------------------------
// Status management
// ---------------------------------------------------------------------------

export async function updateConversationStatus(workspaceId, conversationId, status) {
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

export async function linkCustomer(workspaceId, conversationId, shopifyCustomerId) {
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

async function matchShopifyCustomer(workspaceId, email) {
  if (!email) return null

  try {
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('shopify_domain, shopify_api_key')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (!client?.shopify_domain || !client?.shopify_api_key) return null

    const res = await fetch(
      `https://${client.shopify_domain}/admin/api/2024-01/customers/search.json?query=email:${encodeURIComponent(email)}`,
      {
        headers: {
          'X-Shopify-Access-Token': client.shopify_api_key,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!res.ok) return null
    const data = await res.json()

    if (data.customers?.length > 0) {
      return String(data.customers[0].id)
    }
  } catch (err) {
    console.error('Shopify customer match failed:', err.message)
  }

  return null
}
