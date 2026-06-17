import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import { requireWriteAccess, requireCapability } from '../middleware/workspace.ts'
import { getAdminClient } from '../lib/supabase.ts'
import type { AuthContext } from '../lib/types.ts'

const app = new Hono()

app.use('*', authMiddleware)

const VALID_COLORS = new Set([
  'slate', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald',
  'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
])

// GET /tags — list workspace tags
app.get('/', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()
  const { data, error } = await sb
    .from('tags')
    .select('id, name, color')
    .eq('workspace_id', ctx.workspace.id)
    .order('name', { ascending: true })
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ tags: data ?? [] })
})

// POST /tags — create a workspace tag
app.post('/', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const blocked = requireWriteAccess(c) ?? requireCapability('manageConversations')(c)
  if (blocked) return blocked
  const sb = getAdminClient()

  const body = await c.req.json<{ name?: string; color?: string }>()
  const name = (body.name ?? '').trim()
  if (!name) return c.json({ error: 'Tag name is required' }, 400)
  const color = body.color && VALID_COLORS.has(body.color) ? body.color : 'slate'

  const { data, error } = await sb
    .from('tags')
    .insert({ workspace_id: ctx.workspace.id, name, color, created_by: ctx.user.id })
    .select('id, name, color')
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ tag: data })
})

export { app as tagRoutes }
