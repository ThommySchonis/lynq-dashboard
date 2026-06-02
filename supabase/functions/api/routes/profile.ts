import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import { getAdminClient } from '../lib/supabase.ts'
import type { AuthContext } from '../lib/types.ts'

interface ProfileRow {
  display_name?: string
  bio?: string
  avatar_url?: string
  theme?: string
  welcome_dismissed_at?: string | null
  setup_checklist_dismissed_at?: string | null
}

function sanitizeName(raw: string): string {
  return raw.replace(/[\x00-\x1F\x7F]/g, '').replace(/\s+/g, ' ').trim().slice(0, 50)
}

function sanitizeBio(raw: string): string {
  return raw.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, 200)
}

const app = new Hono()

app.use('*', authMiddleware)

app.get('/', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()

  const { data: row, error } = await sb
    .from('user_profiles')
    .select('display_name, bio, avatar_url, theme, welcome_dismissed_at, setup_checklist_dismissed_at')
    .eq('user_id', ctx.user.id)
    .maybeSingle()

  if (error) {
    return c.json({ error: error.message }, 500)
  }

  const typedRow = row as ProfileRow | null
  const meta = (ctx.user.user_metadata || {}) as Record<string, unknown>

  return c.json({
    profile: {
      email: ctx.user.email,
      display_name: typedRow?.display_name ?? meta.name ?? null,
      bio: typedRow?.bio ?? null,
      avatar_url: typedRow?.avatar_url ?? meta.avatar_url ?? null,
      theme: typedRow?.theme ?? 'system',
      welcome_dismissed_at: typedRow?.welcome_dismissed_at ?? null,
      setup_checklist_dismissed_at: typedRow?.setup_checklist_dismissed_at ?? null,
    },
  })
})

app.patch('/', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()
  const body = await c.req.json()

  const update: Record<string, unknown> = {}

  if (body.display_name !== undefined) {
    const name = sanitizeName(body.display_name)
    if (!name) return c.json({ error: 'Name is required' }, 400)
    update.display_name = name
  }
  if (body.bio !== undefined) {
    update.bio = sanitizeBio(body.bio) || null
  }
  if (body.theme !== undefined) {
    update.theme = body.theme
  }
  if (body.dismiss_welcome === true) {
    update.welcome_dismissed_at = new Date().toISOString()
  } else if (body.welcome_dismissed_at === null) {
    update.welcome_dismissed_at = null
  }
  if (body.dismiss_setup_checklist === true) {
    update.setup_checklist_dismissed_at = new Date().toISOString()
  } else if (body.setup_checklist_dismissed_at === null) {
    update.setup_checklist_dismissed_at = null
  }

  if (Object.keys(update).length === 0) {
    return c.json({ error: 'Nothing to update' }, 400)
  }

  const { data: patchRow, error } = await sb
    .from('user_profiles')
    .upsert({ user_id: ctx.user.id, ...update }, { onConflict: 'user_id' })
    .select('display_name, bio, avatar_url, theme, welcome_dismissed_at, setup_checklist_dismissed_at')
    .single()

  if (error || !patchRow) {
    return c.json({ error: error?.message ?? 'Failed to save profile' }, 500)
  }

  if (update.display_name !== undefined) {
    const newMeta = { ...(ctx.user.user_metadata || {}), name: update.display_name }
    await sb.auth.admin.updateUserById(ctx.user.id, { user_metadata: newMeta })
  }

  const row = patchRow as ProfileRow
  return c.json({
    profile: {
      email: ctx.user.email,
      display_name: row.display_name,
      bio: row.bio,
      avatar_url: row.avatar_url,
      theme: row.theme,
      welcome_dismissed_at: row.welcome_dismissed_at,
      setup_checklist_dismissed_at: row.setup_checklist_dismissed_at,
    },
  })
})

app.post('/avatar', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()

  const formData = await c.req.formData()
  const file = formData.get('file') as File | null

  if (!file) return c.json({ error: 'No file provided' }, 400)
  if (file.size > 500 * 1024) return c.json({ error: 'File too large (max 500KB)' }, 400)

  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
  if (!allowed.includes(file.type)) return c.json({ error: 'Only PNG, JPG, and WebP allowed' }, 400)

  const ext = file.name.split('.').pop() || 'jpg'
  const path = `avatars/${ctx.user.id}.${ext}`

  const { error: uploadError } = await sb.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) return c.json({ error: uploadError.message }, 500)

  const { data: urlData } = sb.storage.from('avatars').getPublicUrl(path)
  const avatarUrl = urlData.publicUrl

  await sb
    .from('user_profiles')
    .upsert({ user_id: ctx.user.id, avatar_url: avatarUrl }, { onConflict: 'user_id' })

  const newMeta = { ...(ctx.user.user_metadata || {}), avatar_url: avatarUrl }
  await sb.auth.admin.updateUserById(ctx.user.id, { user_metadata: newMeta })

  return c.json({ avatar_url: avatarUrl })
})

app.delete('/avatar', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()

  const { data: files } = await sb.storage.from('avatars').list('avatars', {
    search: ctx.user.id,
  })

  if (files && files.length > 0) {
    const paths = files.map((f) => `avatars/${f.name}`)
    await sb.storage.from('avatars').remove(paths)
  }

  await sb
    .from('user_profiles')
    .update({ avatar_url: null })
    .eq('user_id', ctx.user.id)

  const newMeta = { ...(ctx.user.user_metadata || {}), avatar_url: null }
  await sb.auth.admin.updateUserById(ctx.user.id, { user_metadata: newMeta })

  return c.json({ ok: true })
})

export { app as profileRoutes }
