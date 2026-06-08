import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import { can } from '../lib/permissions.ts'
import {
  ShopifyBillingError,
  getSubscriptionWithUsage,
  getManageUrl,
  listConnectedStores,
  setBillingStore,
  getBillingAddress,
  listInvoices,
  syncFromShopify,
} from '../lib/services/shopify-billing.ts'
import { BillingServiceError, listAddons, subscribeAddon, listPlans } from '../lib/services/billing.ts'
import type { AuthContext } from '../lib/types.ts'

type Role = 'owner' | 'admin' | 'agent' | 'observer'

const billing = new Hono()
billing.use('*', authMiddleware)

function getCtx(c: { get: (key: string) => unknown }): AuthContext {
  return c.get('authContext') as AuthContext
}

function requireNotImpersonating(ctx: AuthContext): string | null {
  if (ctx.isImpersonating) return 'Action not allowed while impersonating'
  return null
}

function billingError(c: { json: (data: unknown, status: number) => Response }, err: unknown): Response {
  if (err instanceof ShopifyBillingError) {
    return c.json({ error: err.message, code: err.code }, err.statusCode as 400)
  }
  if (err instanceof BillingServiceError) {
    return c.json({ error: err.message, code: err.code }, err.statusCode as 400)
  }
  const msg = err instanceof Error ? err.message : 'Internal server error'
  return c.json({ error: msg }, 500)
}

// GET /billing/addons
billing.get('/addons', async (c) => {
  const ctx = getCtx(c)
  const addons = await listAddons(ctx.workspaceId)
  return c.json({ addons })
})

// POST /billing/addons/:id/subscribe
billing.post('/addons/:id/subscribe', async (c) => {
  const ctx = getCtx(c)
  const blocked = requireNotImpersonating(ctx)
  if (blocked) return c.json({ error: blocked }, 403)
  if (!can.manageBilling(ctx.role as Role)) {
    return c.json({ error: 'Only owners can manage add-ons', code: 'permission_denied' }, 403)
  }

  const addonId = c.req.param('id')
  try {
    const result = await subscribeAddon(ctx.workspaceId, addonId)
    return c.json(result)
  } catch (err) {
    return billingError(c, err)
  }
})

// GET /billing/info
billing.get('/info', async (c) => {
  const ctx = getCtx(c)
  try {
    const billingAddress = await getBillingAddress(ctx.workspaceId)
    return c.json({ billing_address: billingAddress })
  } catch (err) {
    return billingError(c, err)
  }
})

// GET /billing/invoices
billing.get('/invoices', async (c) => {
  const ctx = getCtx(c)
  try {
    const invoices = await listInvoices(ctx.workspaceId)
    return c.json({ invoices })
  } catch (err) {
    return billingError(c, err)
  }
})

// GET /billing/invoices/:id
billing.get('/invoices/:id', async (c) => {
  const ctx = getCtx(c)
  const id = c.req.param('id')
  try {
    const invoices = await listInvoices(ctx.workspaceId)
    const match = invoices.find((i) => i.id === id)
    if (!match) return c.json({ error: 'Invoice not found' }, 404)
    return c.json({ invoice: match })
  } catch (err) {
    return billingError(c, err)
  }
})

// GET /billing/plans
billing.get('/plans', async (c) => {
  const ctx = getCtx(c)
  void ctx // auth gate only
  const plans = await listPlans()
  return c.json({ plans }, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  })
})

// GET /billing/subscription
billing.get('/subscription', async (c) => {
  const ctx = getCtx(c)
  try {
    const data = await getSubscriptionWithUsage(ctx.workspaceId)
    return c.json(data)
  } catch (err) {
    return billingError(c, err)
  }
})

// GET /billing/manage-url
billing.get('/manage-url', async (c) => {
  const ctx = getCtx(c)
  try {
    const url = await getManageUrl(ctx.workspaceId)
    if (!url) return c.json({ error: 'No billing store configured', code: 'no_billing_store' }, 404)
    return c.json({ url })
  } catch (err) {
    return billingError(c, err)
  }
})

// GET /billing/stores
billing.get('/stores', async (c) => {
  const ctx = getCtx(c)
  const stores = await listConnectedStores(ctx.workspaceId)
  return c.json({ stores })
})

// POST /billing/billing-store
billing.post('/billing-store', async (c) => {
  const ctx = getCtx(c)
  const blocked = requireNotImpersonating(ctx)
  if (blocked) return c.json({ error: blocked }, 403)
  if (!can.manageBilling(ctx.role as Role)) {
    return c.json({ error: 'Only owners can change billing store', code: 'permission_denied' }, 403)
  }
  const body = (await c.req.json()) as { integration_id?: string }
  if (!body.integration_id) return c.json({ error: 'integration_id required' }, 400)
  try {
    const result = await setBillingStore(ctx.workspaceId, body.integration_id)
    return c.json(result)
  } catch (err) {
    return billingError(c, err)
  }
})

// POST /billing/sync
billing.post('/sync', async (c) => {
  const ctx = getCtx(c)
  try {
    const sub = await syncFromShopify(ctx.workspaceId)
    return c.json({ subscription: sub })
  } catch (err) {
    return billingError(c, err)
  }
})

export { billing as billingRoutes }
