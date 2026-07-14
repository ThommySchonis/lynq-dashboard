import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import { requireWriteAccess, requireCapability } from '../middleware/workspace.ts'
import { getAdminClient } from '../lib/supabase.ts'
import { resolveSearchConversationIds } from '../lib/services/conversation-search.ts'
import { shopifyGraphQL } from '../lib/services/shopify-graphql.ts'
import type { AuthContext } from '../lib/types.ts'

const app = new Hono()

app.use('*', authMiddleware)

// ── Conversation counts ─────────────────────────────────────────────

app.get('/counts', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()
  const storeId = c.req.query('store_id')
  const emailAccountId = c.req.query('email_account_id')
  const search = c.req.query('search')?.trim()

  // When a search is active, restrict every bucket to the same match set the
  // list route uses, so each badge equals what that folder's list would show.
  let searchIds: string[] | null = null
  if (search) {
    searchIds = await resolveSearchConversationIds(sb, ctx.workspaceId, search, { storeId, emailAccountId })
    if (searchIds.length === 0) {
      return c.json(
        { open: 0, pending: 0, resolved: 0, snoozed: 0, spam: 0, unlinked: 0, trash: 0 },
        200,
        { 'Cache-Control': 'no-store' },
      )
    }
  }

  const baseQuery = () => {
    let q = sb.from('email_conversations').select('id', { count: 'exact', head: true }).eq('workspace_id', ctx.workspaceId)
    if (storeId) q = q.eq('store_id', storeId)
    if (emailAccountId) q = q.eq('email_account_id', emailAccountId)
    if (searchIds) q = q.in('id', searchIds)
    return q
  }

  const [open, pending, resolved, snoozed, spam, unlinked, trash] = await Promise.all([
    baseQuery().eq('status', 'open').neq('is_spam', true),
    baseQuery().eq('status', 'pending').neq('is_spam', true),
    baseQuery().eq('status', 'resolved').neq('is_spam', true),
    baseQuery().eq('status', 'snoozed').neq('is_spam', true),
    baseQuery().eq('is_spam', true),
    baseQuery().is('shopify_customer_id', null).neq('status', 'closed').neq('is_spam', true),
    baseQuery().eq('status', 'closed').neq('is_spam', true),
  ])

  return c.json({
    open: open.count || 0,
    pending: pending.count || 0,
    resolved: resolved.count || 0,
    snoozed: snoozed.count || 0,
    spam: spam.count || 0,
    unlinked: unlinked.count || 0,
    trash: trash.count || 0,
  }, 200, { 'Cache-Control': 'no-store' })
})

// ── Assignable members ─────────────────────────────────────────────

app.get('/members', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()

  const { data: members, error } = await sb
    .from('workspace_members')
    .select('id, user_id, role')
    .eq('workspace_id', ctx.workspace.id)
  if (error) return c.json({ error: error.message }, 500)

  const userIds = (members ?? []).map((m: Record<string, unknown>) => m.user_id as string)
  const { data: profiles } = await sb
    .from('user_profiles')
    .select('user_id, display_name')
    .in('user_id', userIds)

  const nameByUser = new Map<string, string>()
  for (const p of (profiles ?? []) as Array<{ user_id: string; display_name: string | null }>) {
    if (p.display_name) nameByUser.set(p.user_id, p.display_name)
  }

  const result = (members ?? []).map((m: Record<string, unknown>) => ({
    id: m.id as string,
    name: nameByUser.get(m.user_id as string) ?? 'Teammate',
  }))
  return c.json({ members: result })
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
  const blocked = requireWriteAccess(c) ?? requireCapability('manageWorkspace')(c)
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

// ── Shopify customer lookup ─────────────────────────────────────────

// GraphQL Customer node -> only the fields the mapping below needs. Mirrors
// the field set already established by shopify-orders.ts's getCustomer.
interface GqlShopifyCustomerNode {
  id: string
  email: string | null
  firstName: string | null
  lastName: string | null
  numberOfOrders: string
  amountSpent: { amount: string } | null
}

// gid://shopify/Customer/1234 -> "1234" (REST exposed numeric ids, not global ids).
function legacyCustomerId(gid: string): string {
  return gid.split('/').pop() ?? gid
}

app.get('/shopify-customer', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()

  const id = c.req.query('id')
  const q = c.req.query('q')

  if (!id && !q) return c.json({ error: 'q or id parameter required' }, 400)

  const { data: client } = await sb
    .from('clients')
    .select('shopify_domain, shopify_api_key')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (!client?.shopify_domain || !client?.shopify_api_key) {
    return c.json({ customers: [] })
  }

  const credentials = { domain: client.shopify_domain, accessToken: client.shopify_api_key }

  try {
    let nodes: GqlShopifyCustomerNode[]
    if (id) {
      const data = await shopifyGraphQL<{ customer: GqlShopifyCustomerNode | null }>(
        credentials,
        'query($id: ID!){ customer(id: $id){ id email firstName lastName numberOfOrders amountSpent { amount } } }',
        { id: `gid://shopify/Customer/${id}` },
      )
      nodes = data.customer ? [data.customer] : []
    } else {
      const data = await shopifyGraphQL<{ customers: { edges: Array<{ node: GqlShopifyCustomerNode }> } }>(
        credentials,
        'query($q: String!){ customers(first: 10, query: $q){ edges { node { id email firstName lastName numberOfOrders amountSpent { amount } } } } }',
        { q: q! },
      )
      nodes = data.customers.edges.map((e) => e.node)
    }

    return c.json({
      customers: nodes.map((cust) => ({
        id: legacyCustomerId(cust.id),
        email: cust.email,
        name: `${cust.firstName || ''} ${cust.lastName || ''}`.trim(),
        ordersCount: Number(cust.numberOfOrders),
        totalSpent: cust.amountSpent?.amount,
      })),
    })
  } catch {
    return c.json({ customers: [] })
  }
})

export { app as inboxRoutes }
