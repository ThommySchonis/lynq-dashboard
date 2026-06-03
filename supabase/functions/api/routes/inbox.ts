import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import { requireWriteAccess } from '../middleware/workspace.ts'
import { getAdminClient } from '../lib/supabase.ts'
import type { AuthContext } from '../lib/types.ts'

const app = new Hono()

app.use('*', authMiddleware)

// ── Conversation counts ─────────────────────────────────────────────

app.get('/counts', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()
  const storeId = c.req.query('store_id')

  const baseQuery = () => {
    const q = sb.from('email_conversations').select('id', { count: 'exact', head: true }).eq('workspace_id', ctx.workspaceId)
    return storeId ? q.eq('store_id', storeId) : q
  }

  const [open, pending, resolved, unlinked, trash] = await Promise.all([
    baseQuery().eq('status', 'open'),
    baseQuery().eq('status', 'pending'),
    baseQuery().eq('status', 'resolved'),
    baseQuery().is('shopify_customer_id', null).neq('status', 'closed'),
    baseQuery().eq('status', 'closed'),
  ])

  return c.json({
    open: open.count || 0,
    pending: pending.count || 0,
    resolved: resolved.count || 0,
    unlinked: unlinked.count || 0,
    trash: trash.count || 0,
  }, 200, { 'Cache-Control': 'private, max-age=60' })
})

// ── Email accounts list ─────────────────────────────────────────────

app.get('/accounts', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()
  const storeId = c.req.query('store_id')

  let q = sb
    .from('email_accounts')
    .select('id, provider, email_address, display_name, status, is_default, last_sync_at, connected_at')
    .eq('workspace_id', ctx.workspaceId)

  if (storeId) q = q.eq('store_id', storeId)

  const { data, error } = await q.order('connected_at', { ascending: true })

  if (error) return c.json({ error: error.message }, 500)

  return c.json({ accounts: data || [] })
})

// ── Delete email account (cascade) ──────────────────────────────────

app.delete('/accounts/:id', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const blocked = requireWriteAccess(c)
  if (blocked) return blocked

  const sb = getAdminClient()
  const accountId = c.req.param('id')

  const { data: account } = await sb
    .from('email_accounts')
    .select('id')
    .eq('id', accountId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (!account) return c.json({ error: 'Account not found' }, 404)

  const { data: conversations } = await sb
    .from('email_conversations')
    .select('id')
    .eq('email_account_id', accountId)

  const conversationIds = (conversations || []).map((r: { id: string }) => r.id)

  if (conversationIds.length > 0) {
    await sb.from('email_messages').delete().in('conversation_id', conversationIds)
    await sb.from('conversation_notes').delete().in('conversation_id', conversationIds)
    await sb.from('email_conversations').delete().eq('email_account_id', accountId)
  }

  const { error } = await sb
    .from('email_accounts')
    .delete()
    .eq('id', accountId)
    .eq('workspace_id', ctx.workspaceId)

  if (error) return c.json({ error: error.message }, 500)

  return c.json({ success: true })
})

export { app as inboxRoutes }
