import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import { requireWriteAccess } from '../middleware/workspace.ts'
import { getAdminClient } from '../lib/supabase.ts'
import type { AuthContext } from '../lib/types.ts'

const app = new Hono()

app.use('*', authMiddleware)

// ── Brand settings ──────────────────────────────────────────────────

app.get('/brand', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()

  const { data } = await sb
    .from('ai_settings')
    .select('brand_name, language, tone, system_prompt')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  return c.json({ settings: data || {} })
})

app.post('/brand', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const blocked = requireWriteAccess(c)
  if (blocked) return blocked

  const sb = getAdminClient()
  const body = await c.req.json()

  const { brandName, language, tone } = body
  if (!brandName?.trim()) return c.json({ error: 'Brand name is required' }, 400)

  await sb.from('ai_settings').upsert({
    user_id: ctx.user.id,
    workspace_id: ctx.workspaceId,
    brand_name: brandName,
    language,
    tone,
  }, { onConflict: 'user_id' })

  return c.json({ success: true })
})

// ── Email integration intent ────────────────────────────────────────

app.get('/integrations/email', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()

  const { data } = await sb
    .from('email_accounts')
    .select('provider, status, real_email, connected_at')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  const row = data as { provider?: string; status?: string; real_email?: string; connected_at?: string } | null
  return c.json({
    provider: row?.provider ?? null,
    status: row?.status ?? 'not_connected',
    real_email: row?.real_email ?? null,
    connected_at: row?.connected_at ?? null,
  })
})

app.post('/integrations/email', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const blocked = requireWriteAccess(c)
  if (blocked) return blocked

  const sb = getAdminClient()
  const body = await c.req.json()
  const { provider } = body

  if (!provider || !['gmail', 'outlook'].includes(provider)) {
    return c.json({ error: 'Invalid provider' }, 400)
  }

  const { error } = await sb.from('email_accounts').upsert({
    client_id: ctx.user.id,
    workspace_id: ctx.workspaceId,
    provider,
    status: 'pending',
    real_email: null,
    display_name: null,
    forwarding_address: null,
    connected_at: null,
  }, { onConflict: 'client_id' })

  if (error) return c.json({ error: error.message }, 500)

  return c.json({ ok: true, provider, status: 'pending' })
})

// ── Integrations (parcelpanel key save) ─────────────────────────────

app.post('/integrations', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const blocked = requireWriteAccess(c)
  if (blocked) return blocked

  const sb = getAdminClient()
  const storeId = c.req.query('store_id')
  if (!storeId) return c.json({ error: 'store_id required' }, 400)

  const body = await c.req.json()
  const updates: Record<string, unknown> = {}
  if ('parcelpanel_api_key' in body) {
    updates.parcelpanel_api_key = body.parcelpanel_api_key || null
  }

  if (!Object.keys(updates).length) {
    return c.json({ error: 'No supported integration fields provided' }, 400)
  }

  const { error } = await sb
    .from('integrations')
    .update(updates)
    .eq('store_id', storeId)
    .eq('workspace_id', ctx.workspaceId)

  if (error) return c.json({ error: error.message }, 500)

  return c.json({ success: true })
})

export { app as settingsRoutes }
