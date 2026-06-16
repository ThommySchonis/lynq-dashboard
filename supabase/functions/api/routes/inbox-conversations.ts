import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import { requireWriteAccess, requireCapability } from '../middleware/workspace.ts'
import { getAdminClient } from '../lib/supabase.ts'
import type { AuthContext } from '../lib/types.ts'

const app = new Hono()

app.use('*', authMiddleware)

// ── In-memory rate limiter ─────────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(key: string, maxRequests: number, windowMs: number): { allowed: boolean; resetMs: number } {
  const now = Date.now()
  let entry = rateLimitMap.get(key)
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs }
    rateLimitMap.set(key, entry)
  }
  entry.count++
  if (entry.count > maxRequests) {
    return { allowed: false, resetMs: entry.resetAt - now }
  }
  return { allowed: true, resetMs: 0 }
}

function rateLimitGuard(c: { json: (data: unknown, init?: number | Record<string, unknown>) => Response; header: (name: string, value: string) => void }, workspaceId: string): Response | null {
  const rl = checkRateLimit(`ws:${workspaceId}:inbox`, 60, 60_000)
  if (!rl.allowed) {
    c.header('Retry-After', String(Math.ceil(rl.resetMs / 1000)))
    c.header('X-RateLimit-Limit', '60')
    c.header('X-RateLimit-Remaining', '0')
    return c.json({ error: 'Rate limit exceeded', retryAfterMs: rl.resetMs }, 429)
  }
  return null
}

// ── List conversations ─────────────────────────────────────────────

app.get('/', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()

  const limited = rateLimitGuard(c, ctx.workspace.id)
  if (limited) return limited

  const search = c.req.query('search')
  const status = c.req.query('status')
  const unlinked = c.req.query('unlinked')
  const storeId = c.req.query('store_id')
  const emailAccountId = c.req.query('email_account_id')
  const page = parseInt(c.req.query('page') || '0', 10)
  const limit = 50

  if (search) {
    const sanitized = search.replace(/[%_\\]/g, (ch) => `\\${ch}`)
    const pattern = `%${sanitized}%`

    const convIdQuery = () => {
      let q = sb.from('email_conversations').select('id').eq('workspace_id', ctx.workspace.id)
      if (status) q = q.eq('status', status)
      if (unlinked === 'true') q = q.is('shopify_customer_id', null).neq('status', 'closed')
      if (storeId) q = q.eq('store_id', storeId)
      if (emailAccountId) q = q.eq('email_account_id', emailAccountId)
      return q
    }

    const [subjectRes, emailRes, nameRes, bodyRes] = await Promise.all([
      convIdQuery().ilike('subject', pattern).limit(200),
      convIdQuery().ilike('customer_email', pattern).limit(200),
      convIdQuery().ilike('customer_name', pattern).limit(200),
      sb.from('email_messages').select('conversation_id').eq('workspace_id', ctx.workspace.id).ilike('body_text', pattern).limit(200),
    ])

    const subQueryError = subjectRes.error || emailRes.error || nameRes.error || bodyRes.error
    if (subQueryError) return c.json({ error: subQueryError.message }, 500)

    const idSet = new Set<string>()
    for (const row of subjectRes.data || []) idSet.add((row as { id: string }).id)
    for (const row of emailRes.data || []) idSet.add((row as { id: string }).id)
    for (const row of nameRes.data || []) idSet.add((row as { id: string }).id)
    for (const row of bodyRes.data || []) idSet.add((row as { conversation_id: string }).conversation_id)

    if (idSet.size === 0) return c.json({ conversations: [] })

    let finalQ = sb
      .from('email_conversations')
      .select('*, stores(name)')
      .eq('workspace_id', ctx.workspace.id)
      .in('id', [...idSet])
      .order('last_message_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1)

    if (status) finalQ = finalQ.eq('status', status)
    if (unlinked === 'true') finalQ = finalQ.is('shopify_customer_id', null).neq('status', 'closed')
    if (storeId) finalQ = finalQ.eq('store_id', storeId)
    if (emailAccountId) finalQ = finalQ.eq('email_account_id', emailAccountId)

    const { data: conversations, error } = await finalQ
    if (error) return c.json({ error: error.message }, 500)

    const mapped = (conversations || []).map((cv: Record<string, unknown>) => {
      const stores = cv.stores as { name: string } | null
      return { ...cv, store_name: stores?.name ?? null, stores: undefined }
    })
    return c.json({ conversations: mapped })
  }

  let dbQuery = sb
    .from('email_conversations')
    .select('*, stores(name)')
    .eq('workspace_id', ctx.workspace.id)
    .order('last_message_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1)

  if (status) dbQuery = dbQuery.eq('status', status)
  if (unlinked === 'true') dbQuery = dbQuery.is('shopify_customer_id', null).neq('status', 'closed')
  if (storeId) dbQuery = dbQuery.eq('store_id', storeId)
  if (emailAccountId) dbQuery = dbQuery.eq('email_account_id', emailAccountId)

  const { data: conversations, error } = await dbQuery
  if (error) return c.json({ error: error.message }, 500)

  const mapped = (conversations || []).map((cv: Record<string, unknown>) => {
    const stores = cv.stores as { name: string } | null
    return { ...cv, store_name: stores?.name ?? null, stores: undefined }
  })
  return c.json({ conversations: mapped })
})

// ── Get single conversation ────────────────────────────────────────

app.get('/:id', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()
  const id = c.req.param('id')

  const limited = rateLimitGuard(c, ctx.workspace.id)
  if (limited) return limited

  const convResult = await sb
    .from('email_conversations')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', ctx.workspace.id)
    .single()

  const conversation = convResult.data as Record<string, unknown> | null
  if (!conversation) return c.json({ error: 'Not found' }, 404)

  const [{ data: messages }, { data: notes }] = await Promise.all([
    sb.from('email_messages').select('*').eq('conversation_id', id).order('created_at', { ascending: true }),
    sb.from('conversation_notes').select('*').eq('conversation_id', id).order('created_at', { ascending: true }),
  ])

  if (conversation.is_unread) {
    await sb.from('email_conversations').update({ is_unread: false }).eq('id', id)
  }

  return c.json({ conversation, messages: messages || [], notes: notes || [] })
})

// ── Update conversation ────────────────────────────────────────────

app.patch('/:id', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const blocked = requireWriteAccess(c) ?? requireCapability('manageConversations')(c)
  if (blocked) return blocked
  const sb = getAdminClient()
  const id = c.req.param('id')

  const limited = rateLimitGuard(c, ctx.workspace.id)
  if (limited) return limited

  const body = await c.req.json<{
    status?: string
    is_unread?: boolean
    assigned_to?: string | null
    metadata?: Record<string, unknown>
  }>()

  const updates: Record<string, unknown> = {}
  if (body.status) updates.status = body.status
  if (typeof body.is_unread === 'boolean') updates.is_unread = body.is_unread
  if (body.assigned_to !== undefined) updates.assigned_to = body.assigned_to || null

  if (Object.keys(updates).length === 0) {
    return c.json({ error: 'No valid fields to update' }, 400)
  }

  const { error } = await sb
    .from('email_conversations')
    .update(updates)
    .eq('id', id)
    .eq('workspace_id', ctx.workspace.id)

  if (error) return c.json({ error: error.message }, 500)

  // Fire-and-forget analytics tracking
  const sourceResult = await sb
    .from('email_conversations')
    .select('email_accounts(provider)')
    .eq('id', id)
    .single()
  const emailAccounts = (sourceResult.data as Record<string, unknown>)?.email_accounts as Record<string, string> | null
  const source = emailAccounts?.provider || 'custom'

  const trackEvent = async (eventType: string, agentId?: string | null, metadata?: Record<string, unknown>) => {
    await sb.from('support_events').insert({
      workspace_id: ctx.workspace.id,
      event_type: eventType,
      conversation_id: id,
      source,
      agent_id: agentId || null,
      metadata: metadata || {},
    }).then(() => {}, () => {})
  }

  if (body.status === 'resolved') void trackEvent('ticket_resolved', ctx.memberId, body.metadata)
  else if (body.status === 'closed') void trackEvent('ticket_closed', ctx.memberId)
  if (body.assigned_to !== undefined) void trackEvent('ticket_assigned', body.assigned_to)

  return c.json({ success: true })
})

// ── Notes ──────────────────────────────────────────────────────────

app.get('/:id/notes', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()
  const id = c.req.param('id')

  const limited = rateLimitGuard(c, ctx.workspace.id)
  if (limited) return limited

  const { data: notes } = await sb
    .from('conversation_notes')
    .select('*')
    .eq('conversation_id', id)
    .eq('workspace_id', ctx.workspace.id)
    .order('created_at', { ascending: true })

  return c.json({ notes: notes || [] })
})

app.post('/:id/notes', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const blocked = requireWriteAccess(c) ?? requireCapability('manageConversations')(c)
  if (blocked) return blocked
  const sb = getAdminClient()
  const id = c.req.param('id')

  const limited = rateLimitGuard(c, ctx.workspace.id)
  if (limited) return limited

  const body = await c.req.json<{ body: string }>()

  const { data: conv } = await sb
    .from('email_conversations')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', ctx.workspace.id)
    .maybeSingle()

  if (!conv) return c.json({ error: 'Conversation not found' }, 404)

  const noteResult = await sb
    .from('conversation_notes')
    .insert({
      conversation_id: id,
      workspace_id: ctx.workspace.id,
      body: body.body.trim(),
    })
    .select()
    .single()

  if (noteResult.error) return c.json({ error: noteResult.error.message }, 500)

  return c.json({ note: noteResult.data as Record<string, unknown> })
})

export { app as inboxConversationRoutes }
