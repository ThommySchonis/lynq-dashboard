import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import { requireCapability } from '../middleware/workspace.ts'
import { getAdminClient } from '../lib/supabase.ts'
import { getStoreCredentials } from '../lib/store-credentials.ts'
import { getTrackingsByOrderNumbers } from '../../_shared/parcel-panel.ts'
import { logger } from '../lib/logger.ts'
import { DEMO_SHOP, DEMO_ORDERS, DEMO_REFUNDS, DEMO_KPIS, DEMO_TREND } from '../lib/demo-data.ts'
import {
  getKPIs,
  getRevenueTrend,
  checkConnectionStatus,
  getAnalytics,
  getOrders,
  getOrderDetail,
  getRefunds,
  getCustomer,
  createRefund,
  cancelOrder,
  editOrder,
  duplicateOrder,
  updateOrderNote,
  updateOrderAddress,
  fulfillOrder,
  syncOrders,
  searchProducts,
  createDraftOrder,
  ShopifyApiError,
} from '../lib/services/shopify.ts'
import type { AuthContext } from '../lib/types.ts'

const shopify = new Hono()

shopify.use('*', authMiddleware)

// ── Helpers ──────────────────────────────────────────────────────────────────

function requireStoreId(c: { req: { query: (k: string) => string | undefined } }) {
  const storeId = c.req.query('store_id')
  if (!storeId) return null
  return storeId
}

function requireWriteAccess(ctx: AuthContext) {
  if (ctx.isSuspended) return true
  return false
}

function parseDateRange(c: { req: { query: (k: string) => string | undefined } }) {
  const now = new Date()
  const from = c.req.query('from') || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const to = c.req.query('to') || now.toISOString().split('T')[0]
  return { from, to }
}

function shopifyErrorResponse(c: { json: (data: unknown, status: number) => Response }, err: unknown) {
  if (err instanceof ShopifyApiError) {
    return c.json({ error: err.message, status: err.statusCode }, err.statusCode >= 500 ? 502 : err.statusCode)
  }
  const message = err instanceof Error ? err.message : 'Unknown error'
  return c.json({ error: message }, 502)
}

// In-memory rate limiter for product search
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, resetMs: windowMs }
  }
  entry.count++
  if (entry.count > limit) {
    return { allowed: false, resetMs: entry.resetAt - now }
  }
  return { allowed: true, resetMs: entry.resetAt - now }
}

// ── GET /status ──────────────────────────────────────────────────────────────

shopify.get('/status', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const status = await checkConnectionStatus(ctx.workspaceId)
  return c.json(status)
})

// ── GET /kpis ────────────────────────────────────────────────────────────────

shopify.get('/kpis', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const storeId = requireStoreId(c)
  if (!storeId) return c.json({ error: 'store_id is required' }, 400)

  const credentials = await getStoreCredentials(storeId, ctx.workspaceId)
  if (credentials?.domain === DEMO_SHOP) {
    return c.json(DEMO_KPIS, 200, { 'Cache-Control': 'private, max-age=300' })
  }

  try {
    const dateRange = parseDateRange(c)
    const kpis = await getKPIs(ctx.workspaceId, dateRange, storeId)
    const response = kpis.totalOrders === 0 ? { ...kpis, needsSync: true } : kpis
    return c.json(response, 200, { 'Cache-Control': 'private, max-age=300' })
  } catch (err) {
    logger.error('[shopify/kpis]', 'error fetching KPIs', { error: err instanceof Error ? err.message : String(err) })

    const sb = getAdminClient()
    const { data: cached } = await sb
      .from('shopify_orders')
      .select('total_price, financial_status, created_at')
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })
      .limit(500)

    if (cached && cached.length > 0) {
      interface CachedOrder { total_price?: number | string; financial_status?: string }
      const typedCached = cached as CachedOrder[]
      const totalOrders = typedCached.length
      const totalRevenue = typedCached.reduce((sum, o) => sum + (parseFloat(String(o.total_price)) || 0), 0)
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
      const refundedCount = typedCached.filter(o => o.financial_status === 'refunded').length
      return c.json({
        data: { totalOrders, totalRevenue, avgOrderValue, refundedCount, needsSync: false },
        degraded: true,
        service: 'shopify',
        message: 'Showing cached KPIs — Shopify is temporarily unavailable',
      })
    }
    return shopifyErrorResponse(c, err)
  }
})

// ── GET /revenue-trend ───────────────────────────────────────────────────────

shopify.get('/revenue-trend', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const storeId = requireStoreId(c)
  if (!storeId) return c.json({ error: 'store_id is required' }, 400)

  const credentials = await getStoreCredentials(storeId, ctx.workspaceId)
  if (credentials?.domain === DEMO_SHOP) {
    return c.json({ trend: DEMO_TREND }, 200, { 'Cache-Control': 'private, max-age=300' })
  }

  const from = c.req.query('from')
  const to = c.req.query('to')
  if (!from || !to) {
    return c.json({ trend: [] }, 200, { 'Cache-Control': 'private, max-age=300' })
  }

  try {
    const trend = await getRevenueTrend(ctx.workspaceId, { from, to }, storeId)
    return c.json({ trend }, 200, { 'Cache-Control': 'private, max-age=300' })
  } catch (err) {
    logger.error('[shopify/revenue-trend]', 'error fetching revenue trend', { error: err instanceof Error ? err.message : String(err) })

    const sb = getAdminClient()
    const { data: cached } = await sb
      .from('shopify_orders')
      .select('total_price, created_at')
      .eq('workspace_id', ctx.workspaceId)
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: true })
      .limit(500)

    if (cached && cached.length > 0) {
      interface CachedTrendOrder { total_price?: number | string; created_at?: string }
      const typedCached = cached as CachedTrendOrder[]
      const trendMap = new Map<string, number>()
      for (const order of typedCached) {
        const date = String(order.created_at ?? '').split('T')[0] ?? ''
        if (date) {
          trendMap.set(date, (trendMap.get(date) ?? 0) + (parseFloat(String(order.total_price)) || 0))
        }
      }
      const fallbackTrend = Array.from(trendMap.entries()).map(([date, revenue]) => ({ date, revenue }))
      return c.json({
        data: { trend: fallbackTrend },
        degraded: true,
        service: 'shopify',
        message: 'Showing cached revenue trend — Shopify is temporarily unavailable',
      })
    }
    return shopifyErrorResponse(c, err)
  }
})

// ── GET /analytics ───────────────────────────────────────────────────────────

shopify.get('/analytics', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const storeId = requireStoreId(c)
  if (!storeId) return c.json({ error: 'store_id is required' }, 400)

  const credentials = await getStoreCredentials(storeId, ctx.workspaceId)
  if (!credentials) return c.json({ error: 'Store not connected to Shopify' }, 422)

  const dateRange = parseDateRange(c)
  const result = await getAnalytics(credentials, dateRange)
  return c.json(result)
})

// ── GET /orders ──────────────────────────────────────────────────────────────

shopify.get('/orders', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const storeId = requireStoreId(c)
  if (!storeId) return c.json({ error: 'store_id is required' }, 400)

  const credentials = await getStoreCredentials(storeId, ctx.workspaceId)
  if (!credentials) return c.json({ error: 'Store not connected to Shopify' }, 422)
  if (credentials.domain === DEMO_SHOP) return c.json({ orders: DEMO_ORDERS })

  try {
    const orders = await getOrders(credentials)
    return c.json({ orders })
  } catch (err) {
    const sb = getAdminClient()
    const { data: cached } = await sb
      .from('shopify_orders')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (cached && cached.length > 0) {
      return c.json({
        data: { orders: cached },
        degraded: true,
        service: 'shopify',
        message: 'Showing cached orders — Shopify is temporarily unavailable',
      })
    }
    return shopifyErrorResponse(c, err)
  }
})

// ── GET /orders/:id ──────────────────────────────────────────────────────────

shopify.get('/orders/:id', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const storeId = requireStoreId(c)
  if (!storeId) return c.json({ error: 'store_id is required' }, 400)

  const credentials = await getStoreCredentials(storeId, ctx.workspaceId)
  if (!credentials) return c.json({ error: 'Store not connected to Shopify' }, 422)

  try {
    const order = await getOrderDetail(credentials, c.req.param('id'))
    return c.json({ order })
  } catch (err) {
    return shopifyErrorResponse(c, err)
  }
})

// ── GET /refunds ─────────────────────────────────────────────────────────────

shopify.get('/refunds', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const storeId = requireStoreId(c)
  if (!storeId) return c.json({ error: 'store_id is required' }, 400)

  const credentials = await getStoreCredentials(storeId, ctx.workspaceId)
  if (!credentials) return c.json({ error: 'Store not connected to Shopify' }, 422)
  if (credentials.domain === DEMO_SHOP) {
    return c.json({ refunds: DEMO_REFUNDS }, 200, { 'Cache-Control': 'private, max-age=300' })
  }

  try {
    const dateRange = parseDateRange(c)
    const refunds = await getRefunds(credentials, dateRange)
    return c.json({ refunds }, 200, { 'Cache-Control': 'private, max-age=300' })
  } catch (err) {
    const sb = getAdminClient()
    const { data: cached } = await sb
      .from('shopify_orders')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('financial_status', 'refunded')
      .order('created_at', { ascending: false })
      .limit(50)

    if (cached && cached.length > 0) {
      return c.json({
        data: { refunds: cached },
        degraded: true,
        service: 'shopify',
        message: 'Showing cached refunds — Shopify is temporarily unavailable',
      })
    }
    return shopifyErrorResponse(c, err)
  }
})

// ── GET /customer ────────────────────────────────────────────────────────────

shopify.get('/customer', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const storeId = requireStoreId(c)
  if (!storeId) return c.json({ error: 'store_id is required' }, 400)

  const email = c.req.query('email')
  const order = c.req.query('order')
  if (!email && !order) return c.json({ error: 'email or order query param required' }, 400)

  const credentials = await getStoreCredentials(storeId, ctx.workspaceId)
  if (!credentials) return c.json({ error: 'Store not connected to Shopify' }, 422)

  try {
    const result = await getCustomer(credentials, { email, order })
    const orderNumbers = (result.orders ?? [])
      .map((o) => o.name)
      .filter((n): n is string => !!n)
    const trackings = await getTrackingsByOrderNumbers(getAdminClient(), ctx.workspaceId, storeId, orderNumbers)
    const orders = (result.orders ?? []).map((o) => ({
      ...o,
      parcelTrackings: trackings[o.name] ?? [],
    }))
    return c.json({ ...result, orders })
  } catch (err) {
    return shopifyErrorResponse(c, err)
  }
})

// ── GET /products ────────────────────────────────────────────────────────────

shopify.get('/products', async (c) => {
  const ctx = c.get('authContext') as AuthContext

  const rl = checkRateLimit(`ws:${ctx.workspaceId}:shopify-products`, 60, 60_000)
  if (!rl.allowed) {
    return c.json(
      { error: 'Rate limit exceeded', retryAfterMs: rl.resetMs },
      429,
      {
        'Retry-After': String(Math.ceil(rl.resetMs / 1000)),
        'X-RateLimit-Limit': '60',
        'X-RateLimit-Remaining': '0',
      },
    )
  }

  const storeId = requireStoreId(c)
  if (!storeId) return c.json({ error: 'store_id is required' }, 400)

  const q = c.req.query('q')
  if (!q) return c.json({ error: 'q is required' }, 400)

  const limitParam = c.req.query('limit')
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 50) : 20

  const credentials = await getStoreCredentials(storeId, ctx.workspaceId)
  if (!credentials) return c.json({ error: 'Store not connected to Shopify' }, 422)

  try {
    const result = await searchProducts(credentials, q, limit)
    return c.json(result)
  } catch (err) {
    return shopifyErrorResponse(c, err)
  }
})

// ── GET /debug-channels ──────────────────────────────────────────────────────

shopify.get('/debug-channels', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()

  const { data: orders, error } = await sb
    .from('shopify_orders')
    .select('id, order_number, source_name, subtotal_price, total_price, total_discounts, refund_amount, financial_status, cancel_reason, processed_at')
    .eq('workspace_id', ctx.workspaceId)
    .order('processed_at', { ascending: false })
    .limit(500)

  if (error) return c.json({ error: error.message }, 500)

  interface OrderRow { source_name?: string; subtotal_price?: number; total_price?: number; refund_amount?: number; cancel_reason?: string }
  const typedOrders = (orders || []) as OrderRow[]
  const channelMap: Record<string, {
    count: number
    subtotal_sum: number
    total_price_sum: number
    refund_sum: number
    cancelled_count: number
    sample: unknown
  }> = {}

  for (const o of typedOrders) {
    const ch = o.source_name || 'web'
    if (!channelMap[ch]) {
      channelMap[ch] = { count: 0, subtotal_sum: 0, total_price_sum: 0, refund_sum: 0, cancelled_count: 0, sample: null }
    }
    channelMap[ch].count++
    channelMap[ch].subtotal_sum += o.subtotal_price || 0
    channelMap[ch].total_price_sum += o.total_price || 0
    channelMap[ch].refund_sum += o.refund_amount || 0
    if (o.cancel_reason) channelMap[ch].cancelled_count++
    if (!channelMap[ch].sample) channelMap[ch].sample = o
  }

  const channels = Object.entries(channelMap).map(([name, v]) => ({
    source_name: name,
    order_count: v.count,
    cancelled: v.cancelled_count,
    subtotal_sum: v.subtotal_sum.toFixed(2),
    total_price_sum: v.total_price_sum.toFixed(2),
    refund_sum: v.refund_sum.toFixed(2),
    net_via_subtotal: (v.subtotal_sum - v.refund_sum).toFixed(2),
    net_via_total_price: (v.total_price_sum - v.refund_sum).toFixed(2),
    sample_order: v.sample,
  }))

  return c.json({ channels })
})

// ── POST /sync ───────────────────────────────────────────────────────────────

shopify.post('/sync', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  if (requireWriteAccess(ctx)) return c.json({ error: 'workspace_suspended' }, 403)

  const storeId = requireStoreId(c)
  if (!storeId) return c.json({ error: 'store_id is required' }, 400)

  const full = c.req.query('full') === 'true'
  const credentials = await getStoreCredentials(storeId, ctx.workspaceId)
  if (!credentials) return c.json({ error: 'Store not connected to Shopify' }, 422)

  try {
    const result = await syncOrders(ctx.workspaceId, credentials, ctx.user.id, { full, storeId })
    return c.json({ success: true, synced: result.synced })
  } catch (err) {
    logger.error('[shopify/sync]', 'sync error', { error: err instanceof Error ? err.message : String(err) })
    return c.json({ error: 'Sync failed' }, 500)
  }
})

// ── POST /manual-connect ─────────────────────────────────────────────────────

interface ShopifyShopResponse {
  shop?: { name?: string; currency?: string }
}

shopify.post('/manual-connect', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  if (requireWriteAccess(ctx)) return c.json({ error: 'workspace_suspended' }, 403)
  const capBlocked = requireCapability('manageWorkspace')(c)
  if (capBlocked) return capBlocked

  const body = await c.req.json<{ shop?: string; accessToken?: string }>()
  if (!body.shop || !body.accessToken) {
    return c.json({ error: 'shop and accessToken are required' }, 400)
  }

  const shopDomain = body.shop.includes('.myshopify.com')
    ? body.shop.toLowerCase().trim()
    : `${body.shop.toLowerCase().trim()}.myshopify.com`

  const shopRes = await fetch(
    `https://${shopDomain}/admin/api/2025-04/shop.json`,
    { headers: { 'X-Shopify-Access-Token': body.accessToken } },
  )

  if (!shopRes.ok) {
    return c.json({ error: 'Invalid token or store domain. Please check your credentials.' }, 400)
  }

  const shopData = (await shopRes.json()) as ShopifyShopResponse
  const storeName = shopData.shop?.name || shopDomain.replace('.myshopify.com', '')
  const storeCurrency = shopData.shop?.currency || null

  const sb = getAdminClient()

  const { data: store, error: storeError } = await sb
    .from('stores')
    .upsert(
      { workspace_id: ctx.workspaceId, name: storeName },
      { onConflict: 'workspace_id,name' },
    )
    .select('id')
    .single()

  if (storeError || !store) {
    logger.error('[shopify/manual-connect]', 'store upsert failed', { error: storeError?.message })
    return c.json({ error: 'Failed to create store record' }, 500)
  }

  const storeId = store.id

  const { error: upsertError } = await sb
    .from('integrations')
    .upsert(
      {
        workspace_id: ctx.workspaceId,
        client_id: ctx.user.id,
        store_id: storeId,
        shopify_domain: shopDomain,
        shopify_access_token: body.accessToken,
        shopify_connected_at: new Date().toISOString(),
        store_currency: storeCurrency,
        status: 'connected',
      },
      { onConflict: 'workspace_id,store_id' },
    )

  if (upsertError) {
    logger.error('[shopify/manual-connect]', 'integrations upsert failed', { error: upsertError.message })
    return c.json({ error: 'Failed to save credentials' }, 500)
  }

  // Register webhooks (non-blocking)
  const webhookBase = Deno.env.get('NEXT_PUBLIC_APP_URL') || ''
  const webhookTopics = ['orders/create', 'orders/updated', 'orders/cancelled', 'refunds/create']
  try {
    await Promise.all(webhookTopics.map(topic =>
      fetch(`https://${shopDomain}/admin/api/2025-04/webhooks.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': body.accessToken! },
        body: JSON.stringify({
          webhook: {
            topic,
            address: `${webhookBase}/api/webhooks/shopify?store_id=${storeId}&cid=${ctx.workspaceId}`,
            format: 'json',
          },
        }),
      }),
    ))
  } catch (e) {
    logger.warn('[shopify/manual-connect]', 'Webhook registration failed', { error: e instanceof Error ? e.message : String(e) })
  }

  // Initial order sync (non-blocking)
  try {
    await syncOrders(ctx.workspaceId, { domain: shopDomain, accessToken: body.accessToken }, ctx.user.id, { storeId })
  } catch (e) {
    logger.error('[shopify/manual-connect]', 'Initial sync failed', { error: e instanceof Error ? e.message : String(e) })
  }

  return c.json({ success: true, shop: shopDomain, storeName })
})

shopify.delete('/manual-connect', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  if (requireWriteAccess(ctx)) return c.json({ error: 'workspace_suspended' }, 403)
  const capBlocked = requireCapability('manageWorkspace')(c)
  if (capBlocked) return capBlocked

  const sb = getAdminClient()
  await sb.from('integrations').update({
    shopify_domain: null,
    shopify_access_token: null,
    shopify_connected_at: null,
  }).eq('workspace_id', ctx.workspaceId)

  return c.json({ success: true })
})

// ── POST /link ───────────────────────────────────────────────────────────────

interface PendingToken {
  access_token?: string
  scope?: string
  expires_at?: string
}

function normalizeShopDomain(shop: unknown): string {
  const value = String(shop || '').trim().toLowerCase()
  const domain = value.endsWith('.myshopify.com') ? value : `${value}.myshopify.com`
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain) ? domain : ''
}

shopify.post('/link', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  if (requireWriteAccess(ctx)) return c.json({ error: 'workspace_suspended' }, 403)
  const capBlocked = requireCapability('manageWorkspace')(c)
  if (capBlocked) return capBlocked

  const body = await c.req.json<{ shop?: unknown }>()
  const shopDomain = normalizeShopDomain(body.shop)
  if (!shopDomain) return c.json({ error: 'Invalid shop' }, 400)

  const sb = getAdminClient()

  const pendingResult = await sb
    .from('pending_shopify_tokens')
    .select('*')
    .eq('shop', shopDomain)
    .maybeSingle()

  const pending = pendingResult.data as PendingToken | null

  if (!pending || new Date(pending.expires_at ?? 0) < new Date()) {
    return c.json({ error: 'No pending token found or it expired. Please reconnect.' }, 404)
  }

  await sb.from('integrations').upsert({
    client_id: ctx.user.id,
    workspace_id: ctx.workspaceId,
    shopify_domain: shopDomain,
    shopify_access_token: pending.access_token,
    shopify_scope: pending.scope,
    shopify_connected_at: new Date().toISOString(),
  }, { onConflict: 'client_id' })

  await sb.from('pending_shopify_tokens').delete().eq('shop', shopDomain)

  return c.json({ success: true })
})

// ── Order action routes ──────────────────────────────────────────────────────

// POST /orders/:id/refund
shopify.post('/orders/:id/refund', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  if (requireWriteAccess(ctx)) return c.json({ error: 'workspace_suspended' }, 403)
  const capBlocked = requireCapability('manageOrders')(c)
  if (capBlocked) return capBlocked

  const storeId = requireStoreId(c)
  if (!storeId) return c.json({ error: 'store_id is required' }, 400)

  const credentials = await getStoreCredentials(storeId, ctx.workspaceId)
  if (!credentials) return c.json({ error: 'Store not connected to Shopify' }, 422)

  try {
    const body = await c.req.json()
    const refund = await createRefund(credentials, c.req.param('id'), body)
    return c.json({ refund })
  } catch (err) {
    return shopifyErrorResponse(c, err)
  }
})

// POST /orders/:id/cancel
shopify.post('/orders/:id/cancel', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  if (requireWriteAccess(ctx)) return c.json({ error: 'workspace_suspended' }, 403)
  const capBlocked = requireCapability('manageOrders')(c)
  if (capBlocked) return capBlocked

  const storeId = requireStoreId(c)
  if (!storeId) return c.json({ error: 'store_id is required' }, 400)

  const credentials = await getStoreCredentials(storeId, ctx.workspaceId)
  if (!credentials) return c.json({ error: 'Store not connected to Shopify' }, 422)

  try {
    const body = await c.req.json()
    const order = await cancelOrder(credentials, c.req.param('id'), body)
    return c.json({ order })
  } catch (err) {
    return shopifyErrorResponse(c, err)
  }
})

// POST /orders/:id/edit
shopify.post('/orders/:id/edit', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  if (requireWriteAccess(ctx)) return c.json({ error: 'workspace_suspended' }, 403)
  const capBlocked = requireCapability('manageOrders')(c)
  if (capBlocked) return capBlocked

  const storeId = requireStoreId(c)
  if (!storeId) return c.json({ error: 'store_id is required' }, 400)

  const credentials = await getStoreCredentials(storeId, ctx.workspaceId)
  if (!credentials) return c.json({ error: 'Store not connected to Shopify' }, 422)

  try {
    const body = await c.req.json()
    const orderEdit = await editOrder(credentials, c.req.param('id'), body)
    return c.json({ orderEdit })
  } catch (err) {
    return shopifyErrorResponse(c, err)
  }
})

// POST /orders/:id/duplicate
shopify.post('/orders/:id/duplicate', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  if (requireWriteAccess(ctx)) return c.json({ error: 'workspace_suspended' }, 403)
  const capBlocked = requireCapability('manageOrders')(c)
  if (capBlocked) return capBlocked

  const storeId = requireStoreId(c)
  if (!storeId) return c.json({ error: 'store_id is required' }, 400)

  const credentials = await getStoreCredentials(storeId, ctx.workspaceId)
  if (!credentials) return c.json({ error: 'Store not connected to Shopify' }, 422)

  try {
    const body = await c.req.json()
    const draftOrder = await duplicateOrder(credentials, c.req.param('id'), body)
    return c.json({ draftOrder })
  } catch (err) {
    return shopifyErrorResponse(c, err)
  }
})

// PUT /orders/:id/note
shopify.put('/orders/:id/note', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  if (requireWriteAccess(ctx)) return c.json({ error: 'workspace_suspended' }, 403)
  const capBlocked = requireCapability('manageOrders')(c)
  if (capBlocked) return capBlocked

  const storeId = requireStoreId(c)
  if (!storeId) return c.json({ error: 'store_id is required' }, 400)

  const credentials = await getStoreCredentials(storeId, ctx.workspaceId)
  if (!credentials) return c.json({ error: 'Store not connected to Shopify' }, 422)

  try {
    const body = await c.req.json()
    await updateOrderNote(credentials, c.req.param('id'), body)
    return c.json({ success: true })
  } catch (err) {
    return shopifyErrorResponse(c, err)
  }
})

// PUT /orders/:id/address
shopify.put('/orders/:id/address', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  if (requireWriteAccess(ctx)) return c.json({ error: 'workspace_suspended' }, 403)
  const capBlocked = requireCapability('manageOrders')(c)
  if (capBlocked) return capBlocked

  const storeId = requireStoreId(c)
  if (!storeId) return c.json({ error: 'store_id is required' }, 400)

  const credentials = await getStoreCredentials(storeId, ctx.workspaceId)
  if (!credentials) return c.json({ error: 'Store not connected to Shopify' }, 422)

  try {
    const body = await c.req.json()
    const shippingAddress = await updateOrderAddress(credentials, c.req.param('id'), body)
    return c.json({ shippingAddress })
  } catch (err) {
    return shopifyErrorResponse(c, err)
  }
})

// POST /orders/:id/fulfill
shopify.post('/orders/:id/fulfill', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  if (requireWriteAccess(ctx)) return c.json({ error: 'workspace_suspended' }, 403)
  const capBlocked = requireCapability('manageOrders')(c)
  if (capBlocked) return capBlocked

  const storeId = requireStoreId(c)
  if (!storeId) return c.json({ error: 'store_id is required' }, 400)

  const credentials = await getStoreCredentials(storeId, ctx.workspaceId)
  if (!credentials) return c.json({ error: 'Store not connected to Shopify' }, 422)

  try {
    const body = await c.req.json()
    const fulfillment = await fulfillOrder(credentials, c.req.param('id'), body)
    return c.json({ fulfillment })
  } catch (err) {
    return shopifyErrorResponse(c, err)
  }
})

// POST /orders/create (draft order)
shopify.post('/orders/create', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  if (requireWriteAccess(ctx)) return c.json({ error: 'workspace_suspended' }, 403)
  const capBlocked = requireCapability('manageOrders')(c)
  if (capBlocked) return capBlocked

  const storeId = requireStoreId(c)
  if (!storeId) return c.json({ error: 'store_id is required' }, 400)

  const credentials = await getStoreCredentials(storeId, ctx.workspaceId)
  if (!credentials) return c.json({ error: 'Store not connected to Shopify' }, 422)

  try {
    const body = await c.req.json()
    const draftOrder = await createDraftOrder(credentials, body)
    return c.json({ draftOrder })
  } catch (err) {
    return shopifyErrorResponse(c, err)
  }
})

// ── Legacy routes (POST with orderId in body) ────────────────────────────────

shopify.post('/cancel-order', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  if (requireWriteAccess(ctx)) return c.json({ error: 'workspace_suspended' }, 403)
  const capBlocked = requireCapability('manageOrders')(c)
  if (capBlocked) return capBlocked

  const storeId = requireStoreId(c)
  if (!storeId) return c.json({ error: 'store_id is required' }, 400)

  const credentials = await getStoreCredentials(storeId, ctx.workspaceId)
  if (!credentials) return c.json({ error: 'Store not connected to Shopify' }, 422)

  try {
    const body = await c.req.json<{ orderId: string; [key: string]: unknown }>()
    if (!body.orderId) return c.json({ error: 'orderId is required' }, 400)
    const order = await cancelOrder(credentials, body.orderId, body)
    return c.json({ order })
  } catch (err) {
    return shopifyErrorResponse(c, err)
  }
})

shopify.post('/refund-order', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  if (requireWriteAccess(ctx)) return c.json({ error: 'workspace_suspended' }, 403)
  const capBlocked = requireCapability('manageOrders')(c)
  if (capBlocked) return capBlocked

  const storeId = requireStoreId(c)
  if (!storeId) return c.json({ error: 'store_id is required' }, 400)

  const credentials = await getStoreCredentials(storeId, ctx.workspaceId)
  if (!credentials) return c.json({ error: 'Store not connected to Shopify' }, 422)

  try {
    const body = await c.req.json<{ orderId: string; [key: string]: unknown }>()
    if (!body.orderId) return c.json({ error: 'orderId is required' }, 400)
    const refund = await createRefund(credentials, body.orderId, body)
    return c.json({ refund })
  } catch (err) {
    return shopifyErrorResponse(c, err)
  }
})

shopify.post('/duplicate-order', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  if (requireWriteAccess(ctx)) return c.json({ error: 'workspace_suspended' }, 403)
  const capBlocked = requireCapability('manageOrders')(c)
  if (capBlocked) return capBlocked

  const storeId = requireStoreId(c)
  if (!storeId) return c.json({ error: 'store_id is required' }, 400)

  const credentials = await getStoreCredentials(storeId, ctx.workspaceId)
  if (!credentials) return c.json({ error: 'Store not connected to Shopify' }, 422)

  try {
    const body = await c.req.json<{ orderId: string; [key: string]: unknown }>()
    if (!body.orderId) return c.json({ error: 'orderId is required' }, 400)
    const draftOrder = await duplicateOrder(credentials, body.orderId, body)
    return c.json({ draftOrder })
  } catch (err) {
    return shopifyErrorResponse(c, err)
  }
})

shopify.post('/edit-address', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  if (requireWriteAccess(ctx)) return c.json({ error: 'workspace_suspended' }, 403)
  const capBlocked = requireCapability('manageOrders')(c)
  if (capBlocked) return capBlocked

  const storeId = requireStoreId(c)
  if (!storeId) return c.json({ error: 'store_id is required' }, 400)

  const credentials = await getStoreCredentials(storeId, ctx.workspaceId)
  if (!credentials) return c.json({ error: 'Store not connected to Shopify' }, 422)

  try {
    const body = await c.req.json<{ orderId: string; [key: string]: unknown }>()
    if (!body.orderId) return c.json({ error: 'orderId is required' }, 400)
    const shippingAddress = await updateOrderAddress(credentials, body.orderId, body)
    return c.json({ shippingAddress })
  } catch (err) {
    return shopifyErrorResponse(c, err)
  }
})

export { shopify as shopifyRoutes }
