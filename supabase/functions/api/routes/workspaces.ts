import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import { requireWriteAccess } from '../middleware/workspace.ts'
import { getAdminClient } from '../lib/supabase.ts'
import { can } from '../lib/permissions.ts'
import type { AuthContext } from '../lib/types.ts'

const app = new Hono()

app.use('*', authMiddleware)

// ── Logo upload ─────────────────────────────────────────────────────

const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const BUCKET = 'workspace-assets'

app.post('/logo', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const blocked = requireWriteAccess(c)
  if (blocked) return blocked
  if (!can.manageWorkspace(ctx.role as 'owner' | 'admin' | 'agent' | 'observer')) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const sb = getAdminClient()
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null

  if (!file) return c.json({ error: 'No file provided' }, 400)
  if (!ALLOWED_TYPES.includes(file.type)) return c.json({ error: 'File must be PNG, JPG, or WebP' }, 400)

  const bytes = await file.arrayBuffer()
  if (bytes.byteLength > MAX_BYTES) return c.json({ error: 'Image must be under 2 MB' }, 400)

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `logos/${ctx.workspaceId}.${ext}`

  const { error: uploadError } = await sb.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (uploadError) return c.json({ error: uploadError.message }, 500)

  const { data: { publicUrl } } = sb.storage.from(BUCKET).getPublicUrl(path)
  const logoUrl = `${publicUrl}?t=${Date.now()}`

  const { error: updateError } = await sb
    .from('workspaces')
    .update({ logo_url: logoUrl })
    .eq('id', ctx.workspaceId)

  if (updateError) return c.json({ error: updateError.message }, 500)

  return c.json({ logo_url: logoUrl })
})

app.delete('/logo', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const blocked = requireWriteAccess(c)
  if (blocked) return blocked
  if (!can.manageWorkspace(ctx.role as 'owner' | 'admin' | 'agent' | 'observer')) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const sb = getAdminClient()

  for (const ext of ['png', 'jpg', 'webp']) {
    await sb.storage.from(BUCKET).remove([`logos/${ctx.workspaceId}.${ext}`])
  }

  await sb.from('workspaces').update({ logo_url: null }).eq('id', ctx.workspaceId)

  return c.json({ ok: true })
})

// ── Repair membership ───────────────────────────────────────────────

app.post('/repair-membership', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()

  const { data: existing } = await sb
    .from('workspace_members')
    .select('id, workspace_id, role')
    .eq('user_id', ctx.user.id)
    .maybeSingle()

  if (existing) {
    return c.json({ ok: true, status: 'already_member', workspaceId: (existing as { workspace_id: string }).workspace_id })
  }

  const { data: ownerMembership } = await sb
    .from('workspace_members')
    .select('id, workspace_id')
    .eq('user_id', ctx.user.id)
    .eq('role', 'owner')
    .maybeSingle()

  if (ownerMembership) {
    return c.json({ ok: true, status: 'repaired', workspaceId: (ownerMembership as { workspace_id: string }).workspace_id })
  }

  const meta = (ctx.user.user_metadata ?? {}) as Record<string, string>
  const workspaceName = meta.name || ctx.user.email?.split('@')[0] || 'My Workspace'

  const { data: result, error } = await sb.rpc('provision_workspace', {
    p_user_id: ctx.user.id,
    p_workspace_name: workspaceName,
  })

  const provision = result as { workspace_id?: string } | null
  if (error || !provision?.workspace_id) {
    return c.json({ error: error?.message ?? 'Failed to provision workspace' }, 500)
  }

  return c.json({ ok: true, status: 'provisioned', workspaceId: provision.workspace_id })
})

export { app as workspaceRoutes }
