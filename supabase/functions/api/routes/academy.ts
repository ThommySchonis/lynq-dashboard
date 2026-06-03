import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import { can } from '../lib/permissions.ts'
import {
  getWorkspaceFeatures,
  listAddons,
  subscribeAddon,
} from '../lib/services/billing.ts'
import type { AuthContext } from '../lib/types.ts'

type Role = 'owner' | 'admin' | 'agent' | 'observer'

const academy = new Hono()
academy.use('*', authMiddleware)

function getCtx(c: { get: (key: string) => unknown }): AuthContext {
  return c.get('authContext') as AuthContext
}

// GET /academy/access
academy.get('/access', async (c) => {
  const ctx = getCtx(c)

  const features = await getWorkspaceFeatures(ctx.workspaceId)
  if (features.academy_access) {
    return c.json({ hasAccess: true })
  }

  const addons = await listAddons(ctx.workspaceId)
  const addon = addons.find((a: { id: string; status?: string }) => a.id === 'academy')

  if (addon?.status === 'active') {
    return c.json({ hasAccess: true })
  }

  return c.json({
    hasAccess: false,
    canPurchase: true,
    addonPrice: addon?.price_eur ?? 100,
  })
})

// POST /academy/purchase
academy.post('/purchase', async (c) => {
  const ctx = getCtx(c)

  if (ctx.role === 'observer') {
    return c.json({ error: 'Observers cannot purchase add-ons', code: 'permission_denied' }, 403)
  }

  if (Deno.env.get('PAYMENTS_ENABLED') !== 'true') {
    return c.json({ error: 'Payments are not enabled' }, 503)
  }

  const features = await getWorkspaceFeatures(ctx.workspaceId)
  if (features.academy_access) {
    return c.json({ error: 'Academy access is already included in your plan' }, 400)
  }

  const addons = await listAddons(ctx.workspaceId)
  const addon = addons.find((a: { id: string; status?: string }) => a.id === 'academy')

  if (addon?.status === 'active') {
    return c.json({ error: 'Academy add-on is already active' }, 400)
  }

  const result = await subscribeAddon(ctx.workspaceId, 'academy')
  return c.json({ success: true, addon: 'academy', status: result.status })
})

export { academy as academyRoutes }
