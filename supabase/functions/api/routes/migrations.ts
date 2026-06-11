// supabase/functions/api/routes/migrations.ts

import { Hono } from 'hono'
import type { Context } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import { requireWriteAccess } from '../middleware/workspace.ts'
import { getAdminClient } from '../lib/supabase.ts'
import { can } from '../lib/permissions.ts'
import type { AuthContext } from '../lib/types.ts'
import { getAdapter, listSupportedPlatforms } from '../lib/services/migrations/registry.ts'
import type { SourcePlatform } from '../lib/services/migrations/types.ts'

type Role = 'owner' | 'admin' | 'agent' | 'observer'

const app = new Hono()
app.use('*', authMiddleware)

// Helper: returns a 403 Response if caller lacks manageMigrations capability.
// Returns null otherwise. The caller checks `if (blocked) return blocked`.
function requireManager(c: Context): Response | null {
  const ctx = c.get('authContext') as AuthContext
  if (!can.manageMigrations(ctx.role as Role)) {
    return c.json({ error: 'Forbidden — owner or admin only' }, 403)
  }
  return null
}

// POST /migrations — create a draft
app.post('/', async (c) => {
  const blocked = requireWriteAccess(c) || requireManager(c)
  if (blocked) return blocked
  const ctx = c.get('authContext') as AuthContext
  const { source_platform, source_subdomain } = await c.req.json()
  if (!listSupportedPlatforms().includes(source_platform)) {
    return c.json({ error: `Unsupported platform: ${source_platform}` }, 400)
  }
  const sb = getAdminClient()
  const { data, error } = await sb.from('workspace_migrations').insert({
    workspace_id: ctx.workspaceId,
    source_platform,
    source_subdomain: source_subdomain ?? null,
    auth_method: 'api_key',
    status: 'draft',
  }).select('id').single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ id: data.id })
})

// GET /migrations — list for current workspace
app.get('/', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()
  const { data, error } = await sb.from('workspace_migrations')
    .select('*')
    .eq('workspace_id', ctx.workspaceId)
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ migrations: data })
})

// GET /migrations/:id — full state for progress UI
app.get('/:id', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()
  const { data, error } = await sb.from('workspace_migrations')
    .select('*').eq('id', c.req.param('id')).eq('workspace_id', ctx.workspaceId).single()
  if (error) return c.json({ error: error.message }, 404)
  return c.json({ migration: data })
})

// POST /migrations/:id/auth — submit credentials, verify, list mailboxes
app.post('/:id/auth', async (c) => {
  const blocked = requireWriteAccess(c) || requireManager(c)
  if (blocked) return blocked
  const ctx = c.get('authContext') as AuthContext
  const id = c.req.param('id')
  const body = await c.req.json() as {
    auth_method: 'oauth' | 'api_key'
    subdomain?: string
    access_token?: string
    api_key?: string
    username?: string
  }
  const sb = getAdminClient()

  const { data: job, error: jobErr } = await sb.from('workspace_migrations')
    .select('*').eq('id', id).eq('workspace_id', ctx.workspaceId).single()
  if (jobErr || !job) return c.json({ error: 'Migration not found' }, 404)

  const adapter = getAdapter(job.source_platform as SourcePlatform)
  const creds = {
    authMethod: body.auth_method,
    subdomain: body.subdomain,
    accessToken: body.access_token,
    apiKey: body.api_key,
    username: body.username,
  }
  try {
    await adapter.verifyCredentials(creds)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Verification failed' }, 400)
  }

  const { data: integ, error: integErr } = await sb.from('integrations').insert({
    workspace_id: ctx.workspaceId,
    kind: `${job.source_platform}_migration`,
    migration_auth_method: body.auth_method,
    migration_access_token: body.access_token ?? null,
    migration_api_key: body.api_key ?? null,
    migration_username: body.username ?? null,
    migration_subdomain: body.subdomain ?? null,
  }).select('id').single()
  if (integErr) return c.json({ error: integErr.message }, 500)

  const mailboxes = await adapter.listMailboxes(creds)

  await sb.from('workspace_migrations').update({
    credentials_ref: integ.id,
    auth_method: body.auth_method,
    source_subdomain: body.subdomain ?? null,
  }).eq('id', id)

  return c.json({ mailboxes })
})

// POST /migrations/:id/mailbox-links — { mailbox_links: {sourceId: emailAccountId} }
app.post('/:id/mailbox-links', async (c) => {
  const blocked = requireWriteAccess(c) || requireManager(c)
  if (blocked) return blocked
  const ctx = c.get('authContext') as AuthContext
  const { mailbox_links } = await c.req.json() as { mailbox_links: Record<string, string> }
  const sb = getAdminClient()
  const { error } = await sb.from('workspace_migrations')
    .update({ mailbox_links }).eq('id', c.req.param('id')).eq('workspace_id', ctx.workspaceId)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ success: true })
})

// POST /migrations/:id/start — { time_range_start, time_range_end }
app.post('/:id/start', async (c) => {
  const blocked = requireWriteAccess(c) || requireManager(c)
  if (blocked) return blocked
  const ctx = c.get('authContext') as AuthContext
  const { time_range_start, time_range_end } = await c.req.json() as { time_range_start: string; time_range_end: string }
  const sb = getAdminClient()
  const { data: job } = await sb.from('workspace_migrations')
    .select('mailbox_links, credentials_ref').eq('id', c.req.param('id')).eq('workspace_id', ctx.workspaceId).single()
  if (!job?.credentials_ref) return c.json({ error: 'Authenticate first' }, 400)
  if (!job.mailbox_links || Object.keys(job.mailbox_links).length === 0) {
    return c.json({ error: 'Link at least one mailbox before starting' }, 400)
  }
  const { error } = await sb.from('workspace_migrations').update({
    status: 'ready',
    time_range_start,
    time_range_end,
  }).eq('id', c.req.param('id'))
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ success: true })
})

// POST /migrations/:id/retry
app.post('/:id/retry', async (c) => {
  const blocked = requireWriteAccess(c) || requireManager(c)
  if (blocked) return blocked
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()
  const { error } = await sb.from('workspace_migrations')
    .update({ status: 'ready', error: null })
    .eq('id', c.req.param('id')).eq('workspace_id', ctx.workspaceId).eq('status', 'failed')
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ success: true })
})

// POST /migrations/:id/cancel
app.post('/:id/cancel', async (c) => {
  const blocked = requireWriteAccess(c) || requireManager(c)
  if (blocked) return blocked
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()
  const { error } = await sb.from('workspace_migrations')
    .update({ status: 'cancelled' })
    .eq('id', c.req.param('id')).eq('workspace_id', ctx.workspaceId)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ success: true })
})

export { app as migrationRoutes }
