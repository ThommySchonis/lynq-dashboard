import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import { getAdminClient } from '../lib/supabase.ts'
import { isPlatformAdmin } from '../lib/platform-admin.ts'
import { grandfatherWorkspace, ShopifyBillingError } from '../lib/services/shopify-billing.ts'
import type { AuthContext } from '../lib/types.ts'

const app = new Hono()

app.use('*', authMiddleware)

// Admin guard middleware
app.use('*', async (c, next) => {
  const ctx = c.get('authContext') as AuthContext
  const isAdmin = await isPlatformAdmin(ctx.user.email)
  if (!isAdmin) return c.json({ error: 'Forbidden' }, 403)
  return next()
})

// ── Feedback list ───────────────────────────────────────────────────

app.get('/feedback', async (c) => {
  const sb = getAdminClient()

  const { data: rows, error } = await sb
    .from('feedback_submissions')
    .select('id, workspace_id, user_id, type, message, page_url, user_agent, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return c.json({ error: 'Query failed' }, 500)

  interface FeedbackRow { id: string; workspace_id: string; user_id: string; type: string; message: string; page_url: string | null; user_agent: string | null; created_at: string }
  const typedRows = rows as FeedbackRow[]
  const userIds = [...new Set(typedRows.map(r => r.user_id))]
  const workspaceIds = [...new Set(typedRows.map(r => r.workspace_id))]

  const [wsResult, usersRes] = await Promise.all([
    sb.from('workspaces').select('id, name').in('id', workspaceIds),
    sb.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const workspaces = (wsResult.data || []) as { id: string; name: string }[]
  const workspaceById = Object.fromEntries(workspaces.map(w => [w.id, w]))
  const userById = Object.fromEntries(
    (usersRes?.data?.users || [])
      .filter(u => userIds.includes(u.id))
      .map(u => [u.id, { id: u.id, email: u.email, name: (u.user_metadata as Record<string, unknown>)?.name || null }])
  )

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const recentCount = typedRows.filter(r => r.created_at > sevenDaysAgo).length

  const submissions = typedRows.map(r => ({
    ...r,
    workspace: workspaceById[r.workspace_id] || null,
    user: userById[r.user_id] || null,
  }))

  return c.json({ submissions, recentCount })
})

// ── Feedback count ──────────────────────────────────────────────────

app.get('/feedback/count', async (c) => {
  const sb = getAdminClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { count, error } = await sb
    .from('feedback_submissions')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sevenDaysAgo)

  if (error) return c.json({ error: 'Query failed' }, 500)

  return c.json({ count: count || 0 })
})

// ── Grandfather workspace ───────────────────────────────────────────

app.post('/billing/grandfather/:workspaceId', async (c) => {
  const workspaceId = c.req.param('workspaceId')
  const body = (await c.req.json()) as { enabled?: boolean; reason?: string }
  if (typeof body.enabled !== 'boolean') {
    return c.json({ error: 'enabled (boolean) required' }, 400)
  }
  try {
    await grandfatherWorkspace(workspaceId, body.enabled, body.reason ?? null)
    return c.json({ ok: true })
  } catch (err) {
    if (err instanceof ShopifyBillingError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as 400)
    }
    return c.json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})

export { app as lynqAdminRoutes }
