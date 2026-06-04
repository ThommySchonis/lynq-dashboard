import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import { requireWriteAccess } from '../middleware/workspace.ts'
import { getAdminClient } from '../lib/supabase.ts'
import type { AuthContext } from '../lib/types.ts'
import {
  getDisplaySettingsForStore,
  upsertDisplaySettings,
  deleteDisplaySettings,
} from '../lib/services/email-display.ts'

const app = new Hono()
app.use('*', authMiddleware)

const MAX_FILE_SIZE = 2 * 1024 * 1024
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']

app.get('/', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const storeId = c.req.query('storeId')
  if (!storeId) return c.json({ error: 'storeId is required' }, 400)

  try {
    const settings = await getDisplaySettingsForStore(ctx.workspaceId, storeId)
    return c.json({ settings })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})

app.post('/', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const blocked = requireWriteAccess(c)
  if (blocked) return blocked

  const body = await c.req.json()
  const { storeId, emailAccountId, displayName, closingText, signatureHtml, logoUrl, logoWidth, logoLinkUrl, isActive } = body

  if (!storeId) return c.json({ error: 'storeId is required' }, 400)

  try {
    const result = await upsertDisplaySettings({
      workspaceId: ctx.workspaceId,
      storeId,
      emailAccountId: emailAccountId ?? null,
      displayName: displayName ?? null,
      closingText: closingText ?? null,
      signatureHtml: signatureHtml ?? null,
      logoUrl: logoUrl ?? null,
      logoWidth: logoWidth ?? 150,
      logoLinkUrl: logoLinkUrl ?? null,
      isActive: isActive ?? true,
    })
    return c.json({ settings: result })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})

app.delete('/:id', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const blocked = requireWriteAccess(c)
  if (blocked) return blocked

  const id = c.req.param('id')

  try {
    await deleteDisplaySettings(ctx.workspaceId, id)
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})

app.post('/upload-logo', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const blocked = requireWriteAccess(c)
  if (blocked) return blocked

  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
    const storeId = formData.get('storeId') as string | null

    if (!file) return c.json({ error: 'No file provided' }, 400)
    if (!storeId) return c.json({ error: 'storeId is required' }, 400)
    if (!ALLOWED_TYPES.includes(file.type)) {
      return c.json({ error: 'Invalid file type. Allowed: PNG, JPG, SVG, WebP' }, 400)
    }
    if (file.size > MAX_FILE_SIZE) {
      return c.json({ error: 'File too large. Maximum 2MB' }, 400)
    }

    const sb = getAdminClient()
    const ext = file.name.split('.').pop() || 'png'
    const path = `${ctx.workspaceId}/${storeId}/logo-${Date.now()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const { error } = await sb.storage
      .from('email-logos')
      .upload(path, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) throw new Error(error.message)

    const { data: urlData } = sb.storage
      .from('email-logos')
      .getPublicUrl(path)

    return c.json({ logoUrl: urlData.publicUrl })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})

export { app as emailDisplayRoutes }
