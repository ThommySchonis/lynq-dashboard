import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import { can } from '../lib/permissions.ts'
import { getAdminClient } from '../lib/supabase.ts'
import {
  BillingServiceError,
  listAddons,
  subscribeAddon,
  getBillingInfo,
  updateBillingInfo,
  listInvoices,
  getInvoice,
  listPaymentMethods,
  deletePaymentMethod,
  listPlans,
  getSubscriptionWithUsage,
  cancelSubscription,
  changePlan,
  reactivateSubscription,
  getUsageBreakdown,
} from '../lib/services/billing.ts'
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
  const info = await getBillingInfo(ctx.workspaceId)
  return c.json({ billing_info: info })
})

// PATCH /billing/info
billing.patch('/info', async (c) => {
  const ctx = getCtx(c)
  const blocked = requireNotImpersonating(ctx)
  if (blocked) return c.json({ error: blocked }, 403)
  if (!can.manageBilling(ctx.role as Role)) {
    return c.json({ error: 'Only owners can edit billing info', code: 'permission_denied' }, 403)
  }

  const body = await c.req.json()
  try {
    const info = await updateBillingInfo(ctx.workspaceId, body)
    return c.json({ ok: true, billing_info: info })
  } catch (err) {
    return billingError(c, err)
  }
})

// GET /billing/invoices
billing.get('/invoices', async (c) => {
  const ctx = getCtx(c)
  const page = parseInt(c.req.query('page') || '0', 10)
  const perPage = parseInt(c.req.query('per_page') || '25', 10)

  try {
    const { invoices, total } = await listInvoices(ctx.workspaceId, page, perPage)
    return c.json({ invoices, total, page, per_page: perPage })
  } catch (err) {
    if (err instanceof BillingServiceError && err.statusCode < 500) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as 400)
    }

    const sb = getAdminClient()
    const { data: cached } = await sb
      .from('invoices')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })
      .range(page * perPage, (page + 1) * perPage - 1)

    if (cached) {
      return c.json({
        invoices: cached,
        total: cached.length,
        page,
        per_page: perPage,
        _fallback: true,
        _message: 'Showing cached invoices — billing service is temporarily unavailable',
      })
    }
    return billingError(c, err)
  }
})

// GET /billing/invoices/:id
billing.get('/invoices/:id', async (c) => {
  const ctx = getCtx(c)
  const invoiceId = c.req.param('id')
  const invoice = await getInvoice(ctx.workspaceId, invoiceId)
  if (!invoice) return c.json({ error: 'Not found' }, 404)
  return c.json({ invoice })
})

// GET /billing/payment-methods
billing.get('/payment-methods', async (c) => {
  const ctx = getCtx(c)
  try {
    const methods = await listPaymentMethods(ctx.workspaceId)
    return c.json({ payment_methods: methods })
  } catch (err) {
    return billingError(c, err)
  }
})

// POST /billing/payment-methods (stub)
billing.post('/payment-methods', async (c) => {
  const ctx = getCtx(c)
  const blocked = requireNotImpersonating(ctx)
  if (blocked) return c.json({ error: blocked }, 403)
  if (!can.manageBilling(ctx.role as Role)) {
    return c.json({ error: 'Only owners can manage payment methods', code: 'permission_denied' }, 403)
  }

  return c.json(
    { error: 'Payment methods coming soon — Whop integration not yet wired up', code: 'whop_pending' },
    501,
  )
})

// DELETE /billing/payment-methods/:id
billing.delete('/payment-methods/:id', async (c) => {
  const ctx = getCtx(c)
  const blocked = requireNotImpersonating(ctx)
  if (blocked) return c.json({ error: blocked }, 403)
  if (!can.manageBilling(ctx.role as Role)) {
    return c.json({ error: 'Only owners can manage payment methods', code: 'permission_denied' }, 403)
  }

  const methodId = c.req.param('id')
  try {
    await deletePaymentMethod(ctx.workspaceId, methodId)
    return c.json({ ok: true })
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
    const sb = getAdminClient()
    const cachedResult = await sb
      .from('workspace_subscriptions')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()
    const cached = cachedResult.data

    if (cached) {
      return c.json({
        ...cached,
        _fallback: true,
        _message: 'Showing cached subscription — billing service is temporarily unavailable',
      })
    }
    return billingError(c, err)
  }
})

// POST /billing/subscription/cancel
billing.post('/subscription/cancel', async (c) => {
  const ctx = getCtx(c)
  const blocked = requireNotImpersonating(ctx)
  if (blocked) return c.json({ error: blocked }, 403)
  if (!can.manageBilling(ctx.role as Role)) {
    return c.json({ error: 'Only owners can cancel', code: 'permission_denied' }, 403)
  }

  try {
    const sub = await cancelSubscription(ctx.workspaceId, true)
    return c.json({ ok: true, subscription: sub })
  } catch (err) {
    return billingError(c, err)
  }
})

// POST /billing/subscription/change-plan
billing.post('/subscription/change-plan', async (c) => {
  const ctx = getCtx(c)
  const blocked = requireNotImpersonating(ctx)
  if (blocked) return c.json({ error: blocked }, 403)
  if (!can.manageBilling(ctx.role as Role)) {
    return c.json({ error: 'Only owners can change plans', code: 'permission_denied' }, 403)
  }

  const body = await c.req.json() as { plan_id?: string; success_url?: string }
  if (!body.plan_id) {
    return c.json({ error: 'plan_id is required', code: 'validation_error' }, 400)
  }

  try {
    const outcome = await changePlan(ctx.workspaceId, body.plan_id, { successUrl: body.success_url })
    return c.json({ ok: true, ...outcome })
  } catch (err) {
    return billingError(c, err)
  }
})

// POST /billing/subscription/reactivate
billing.post('/subscription/reactivate', async (c) => {
  const ctx = getCtx(c)
  const blocked = requireNotImpersonating(ctx)
  if (blocked) return c.json({ error: blocked }, 403)
  if (!can.manageBilling(ctx.role as Role)) {
    return c.json({ error: 'Only owners can reactivate', code: 'permission_denied' }, 403)
  }

  try {
    const sub = await reactivateSubscription(ctx.workspaceId)
    return c.json({ ok: true, subscription: sub })
  } catch (err) {
    return billingError(c, err)
  }
})

// GET /billing/usage
billing.get('/usage', async (c) => {
  const ctx = getCtx(c)

  try {
    const usage = await getUsageBreakdown(ctx.workspaceId)
    if (!usage) return c.json({ error: 'No active subscription' }, 404)
    return c.json(usage)
  } catch (err) {
    const sb = getAdminClient()
    const { data: cached } = await sb
      .from('usage_counters')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)

    if (cached) {
      return c.json({
        ...cached,
        _fallback: true,
        _message: 'Showing cached usage — billing service is temporarily unavailable',
      })
    }
    return billingError(c, err)
  }
})

export { billing as billingRoutes }
