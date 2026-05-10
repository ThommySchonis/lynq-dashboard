# Backend Service Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract all Shopify business logic from API route handlers into `lib/services/`, standardize on workspace-scoped auth, add PostgreSQL stored functions for aggregations, and create Supabase Edge Functions for webhooks/cron sync.

**Architecture:** Bottom-up — build service layer first, then rewire routes. Services are pure functions (no request/response objects). Routes become thin orchestrators: auth → credentials → service call → JSON response. All routes migrate from legacy `getUserFromToken` to workspace-scoped `getAuthContext`.

**Tech Stack:** Next.js API routes, Supabase (PostgreSQL + Edge Functions), Shopify REST/GraphQL API

**Spec:** `docs/superpowers/specs/2026-05-09-backend-service-layer-design.md`

---

### Task 1: Create `lib/utils/request.js`

**Files:**
- Create: `lib/utils/request.js`

- [ ] **Step 1: Create the helper module**

```js
// lib/utils/request.js

/**
 * Parse ?from=YYYY-MM-DD&to=YYYY-MM-DD from request URL.
 * Falls back to start-of-current-month to today in Amsterdam timezone.
 * Returns bare YYYY-MM-DD strings — callers add time boundaries if needed.
 */
export function parseDateRange(request) {
  const { searchParams } = new URL(request.url)
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  if (fromParam && toParam) {
    return { from: fromParam, to: toParam }
  }

  // Default: start of current month → today in Amsterdam timezone
  const now = new Date()
  const amsterdamNow = new Date(
    now.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })
  )
  const year = amsterdamNow.getFullYear()
  const month = String(amsterdamNow.getMonth() + 1).padStart(2, '0')
  const day = String(amsterdamNow.getDate()).padStart(2, '0')

  return {
    from: `${year}-${month}-01`,
    to: `${year}-${month}-${day}`,
  }
}
```

---

### Task 2: Create PostgreSQL stored functions

**Files:**
- Create: `supabase/migrations/20260509_service_layer_functions.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- supabase/migrations/20260509_service_layer_functions.sql

-- get_kpis: aggregate KPI data for a workspace within a date range
CREATE OR REPLACE FUNCTION get_kpis(
  p_workspace_id UUID,
  p_from DATE,
  p_to DATE
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'totalOrders', COUNT(*)::int,
    'cancelledOrders', COUNT(*) FILTER (WHERE cancel_reason IS NOT NULL)::int,
    'totalRefunds', COUNT(*) FILTER (WHERE cancel_reason IS NULL AND refund_amount > 0)::int,
    'netRevenue', COALESCE(SUM(CASE WHEN cancel_reason IS NULL THEN subtotal_price - COALESCE(refund_amount, 0) ELSE 0 END), 0),
    'discounts', COALESCE(SUM(CASE WHEN cancel_reason IS NULL THEN COALESCE(total_discounts, 0) ELSE 0 END), 0),
    'returns', COALESCE(SUM(CASE WHEN cancel_reason IS NULL THEN COALESCE(refund_amount, 0) ELSE 0 END), 0)
  ) INTO result
  FROM shopify_orders
  WHERE workspace_id = p_workspace_id
    AND COALESCE(processed_at, created_at_shopify)::date BETWEEN p_from AND p_to;

  RETURN result;
END;
$$;

-- get_revenue_trend: daily revenue for a workspace, gap-filled
CREATE OR REPLACE FUNCTION get_revenue_trend(
  p_workspace_id UUID,
  p_from DATE,
  p_to DATE
)
RETURNS TABLE(date DATE, revenue NUMERIC)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH days AS (
    SELECT generate_series(p_from, p_to, '1 day'::interval)::date AS d
  ),
  daily AS (
    SELECT
      COALESCE(processed_at, created_at_shopify)::date AS d,
      SUM(subtotal_price - COALESCE(refund_amount, 0)) AS rev
    FROM shopify_orders
    WHERE workspace_id = p_workspace_id
      AND cancel_reason IS NULL
      AND COALESCE(processed_at, created_at_shopify)::date BETWEEN p_from AND p_to
    GROUP BY 1
  )
  SELECT days.d AS date, GREATEST(COALESCE(daily.rev, 0), 0) AS revenue
  FROM days
  LEFT JOIN daily ON days.d = daily.d
  ORDER BY days.d;
END;
$$;
```

---

### Task 3: Create `lib/services/shopify.js` — ShopifyApiError + internal helpers

**Files:**
- Create: `lib/services/shopify.js`

- [ ] **Step 1: Create the file with ShopifyApiError and the internal shopifyFetch helper**

This is the foundation that all service functions use. The `shopifyFetch` helper is moved from `lib/shopify.js` but adapted to use the `{ domain, accessToken }` credential shape.

```js
// lib/services/shopify.js
import { supabaseAdmin } from '../supabaseAdmin'

// ── Error class ──────────────────────────────────────────────────────────────
export class ShopifyApiError extends Error {
  constructor(message, statusCode, endpoint) {
    super(message)
    this.name = 'ShopifyApiError'
    this.statusCode = statusCode
    this.endpoint = endpoint
  }
}

// ── Internal Shopify REST helper ─────────────────────────────────────────────
const SHOPIFY_API_VERSION = '2025-04'

async function shopifyFetch(credentials, path, options = {}) {
  const url = `https://${credentials.domain}/admin/api/${SHOPIFY_API_VERSION}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'X-Shopify-Access-Token': credentials.accessToken,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  return res
}

async function shopifyFetchJSON(credentials, path, options = {}) {
  const res = await shopifyFetch(credentials, path, options)
  const data = await res.json()
  if (!res.ok) {
    throw new ShopifyApiError(
      data.errors || `Shopify API error on ${path}`,
      res.status,
      path
    )
  }
  return data
}
```

This is the first part of the file. Subsequent steps add the exported service functions.

---

### Task 4: Add Supabase-backed service functions to `lib/services/shopify.js`

**Files:**
- Modify: `lib/services/shopify.js`

These functions query the `shopify_orders` Supabase table — they don't call the Shopify API.

- [ ] **Step 1: Add `getKPIs` function**

Append to `lib/services/shopify.js`:

```js
// ── Supabase-backed functions ────────────────────────────────────────────────

/**
 * KPIs from shopify_orders table via PostgreSQL stored function.
 * @param {string} workspaceId
 * @param {{ from: string, to: string }} dateRange - YYYY-MM-DD strings
 */
export async function getKPIs(workspaceId, dateRange) {
  const { data, error } = await supabaseAdmin.rpc('get_kpis', {
    p_workspace_id: workspaceId,
    p_from: dateRange.from,
    p_to: dateRange.to,
  })

  if (error) throw new Error(`get_kpis RPC failed: ${error.message}`)

  const totalOrders = data.totalOrders || 0
  const totalRefunds = data.totalRefunds || 0
  const netRevenue = data.netRevenue || 0
  const returns = data.returns || 0

  const refundRate = totalOrders > 0
    ? ((totalRefunds / totalOrders) * 100).toFixed(1)
    : '0.0'
  const refundPct = netRevenue > 0
    ? ((returns / netRevenue) * 100).toFixed(1)
    : '0.0'

  return {
    totalOrders,
    cancelledOrders: data.cancelledOrders || 0,
    totalRefunds,
    refundRate,
    refundPct,
    netRevenue: Math.round(netRevenue).toString(),
    totalRevenue: Math.round(netRevenue).toString(),
    discounts: Math.round(data.discounts || 0).toString(),
    returns: Math.round(returns).toString(),
    refundAmount: Math.round(returns).toString(),
  }
}
```

- [ ] **Step 2: Add `getRevenueTrend` function**

Append to `lib/services/shopify.js`:

```js
/**
 * Daily revenue trend via PostgreSQL stored function.
 * @param {string} workspaceId
 * @param {{ from: string, to: string }} dateRange - YYYY-MM-DD strings
 */
export async function getRevenueTrend(workspaceId, dateRange) {
  if (!dateRange.from || !dateRange.to) return []

  const { data, error } = await supabaseAdmin.rpc('get_revenue_trend', {
    p_workspace_id: workspaceId,
    p_from: dateRange.from,
    p_to: dateRange.to,
  })

  if (error) throw new Error(`get_revenue_trend RPC failed: ${error.message}`)

  return (data || []).map(row => ({
    date: row.date,
    revenue: Math.max(0, Number(row.revenue) || 0),
  }))
}
```

- [ ] **Step 3: Add `checkConnectionStatus` function**

Append to `lib/services/shopify.js`:

```js
/**
 * Check if Shopify credentials exist for a workspace. No API call.
 * @param {string} workspaceId
 */
export async function checkConnectionStatus(workspaceId) {
  const { data: integration } = await supabaseAdmin
    .from('integrations')
    .select('shopify_domain')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (integration?.shopify_domain) {
    return { connected: true, shop: integration.shopify_domain }
  }
  return { connected: false }
}
```

- [ ] **Step 4: Add `getAnalytics` function**

Append to `lib/services/shopify.js`. This wraps the ShopifyQL GraphQL query currently in `/api/shopify/analytics/route.js`:

```js
/**
 * Monthly analytics via Shopify GraphQL (ShopifyQL).
 * @param {{ domain: string, accessToken: string }} credentials
 * @param {{ from: string, to: string }} dateRange - YYYY-MM-DD strings
 */
export async function getAnalytics(credentials, dateRange) {
  const query = `
    FROM orders
    SHOW
      sum(net_sales) AS net_sales,
      sum(gross_sales) AS gross_sales,
      sum(discounts) AS discounts,
      sum(returns) AS returns,
      count(orders) AS total_orders
    SINCE ${dateRange.from} UNTIL ${dateRange.to}
  `

  const gqlQuery = `
    mutation shopifyqlQuery($query: String!) {
      shopifyqlQuery(query: $query) {
        tableData {
          unformattedData {
            headers
            rowData
          }
        }
        parseErrors { code message }
      }
    }
  `

  const res = await fetch(
    `https://${credentials.domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': credentials.accessToken,
      },
      body: JSON.stringify({ query: gqlQuery, variables: { query } }),
    }
  )

  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = text }

  return { status: res.status, raw: data }
}
```

---

### Task 5: Add Shopify API-backed service functions — data fetching

**Files:**
- Modify: `lib/services/shopify.js`

- [ ] **Step 1: Add `getOrders` function**

Append to `lib/services/shopify.js`:

```js
// ── Shopify API-backed functions ─────────────────────────────────────────────

/**
 * Fetch recent orders from Shopify REST API.
 * @param {{ domain: string, accessToken: string }} credentials
 * @param {{ limit?: number }} options
 */
export async function getOrders(credentials, options = {}) {
  const limit = options.limit || 50
  const data = await shopifyFetchJSON(
    credentials,
    `/orders.json?status=any&limit=${limit}`
  )

  return (data.orders || []).map(o => ({
    id: o.id,
    name: o.name,
    customer: o.customer
      ? `${o.customer.first_name} ${o.customer.last_name}`.trim()
      : 'Unknown',
    total: parseFloat(o.total_price || 0).toFixed(2),
    financialStatus: o.financial_status,
    fulfillmentStatus: o.fulfillment_status || 'unfulfilled',
    cancelReason: o.cancel_reason || null,
    hasRefund: o.refunds && o.refunds.length > 0,
    createdAt: o.created_at,
  }))
}
```

- [ ] **Step 2: Add `getOrderDetail` function**

```js
/**
 * Fetch a single order with full details.
 * @param {{ domain: string, accessToken: string }} credentials
 * @param {string|number} orderId
 */
export async function getOrderDetail(credentials, orderId) {
  const { order } = await shopifyFetchJSON(credentials, `/orders/${orderId}.json`)

  return {
    id: order.id,
    name: order.name,
    createdAt: order.created_at,
    financialStatus: order.financial_status,
    fulfillmentStatus: order.fulfillment_status || 'unfulfilled',
    cancelReason: order.cancel_reason,
    cancelledAt: order.cancelled_at,
    customer: order.customer ? {
      id: order.customer.id,
      firstName: order.customer.first_name,
      lastName: order.customer.last_name,
      email: order.customer.email,
      phone: order.customer.phone,
      ordersCount: order.customer.orders_count,
      totalSpent: order.customer.total_spent,
    } : null,
    shippingAddress: order.shipping_address || null,
    billingAddress: order.billing_address || null,
    lineItems: (order.line_items || []).map(item => ({
      id: item.id,
      title: item.title,
      variantTitle: item.variant_title,
      sku: item.sku,
      quantity: item.quantity,
      price: item.price,
      total: (parseFloat(item.price) * item.quantity).toFixed(2),
    })),
    subtotalPrice: order.subtotal_price,
    totalShippingPrice: order.total_shipping_price_set?.shop_money?.amount || '0.00',
    totalTax: order.total_tax,
    totalPrice: order.total_price,
    currency: order.currency,
    refunds: order.refunds || [],
    fulfillments: (order.fulfillments || []).map(f => ({
      id: f.id,
      status: f.status,
      trackingNumber: f.tracking_number,
      trackingUrl: f.tracking_url,
      trackingCompany: f.tracking_company,
    })),
    tags: order.tags,
    note: order.note,
  }
}
```

- [ ] **Step 3: Add `getRefunds` function**

```js
/**
 * Fetch refunds from Shopify with pagination and date filtering.
 * @param {{ domain: string, accessToken: string }} credentials
 * @param {{ from: string, to: string }} dateRange - YYYY-MM-DD strings
 */
export async function getRefunds(credentials, dateRange) {
  const from = dateRange.from
  const to = dateRange.to

  let nextUrl = `https://${credentials.domain}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&limit=250`
  if (from) nextUrl += `&updated_at_min=${from}T00:00:00`
  if (to) nextUrl += `&updated_at_max=${to}T23:59:59`

  const allOrders = []

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: { 'X-Shopify-Access-Token': credentials.accessToken },
    })

    if (res.status === 429) {
      const wait = parseInt(res.headers.get('Retry-After') || '2') * 1000
      await new Promise(r => setTimeout(r, wait))
      continue
    }

    if (!res.ok) {
      throw new ShopifyApiError('Failed to fetch orders for refunds', res.status, nextUrl)
    }

    const data = await res.json()
    allOrders.push(...(data.orders || []))

    const link = res.headers.get('link')
    const next = link?.match(/<([^>]+)>;\s*rel="next"/)
    nextUrl = next ? next[1] : null
  }

  const fromTs = from ? `${from}T00:00:00` : null
  const toTs = to ? `${to}T23:59:59` : null

  return allOrders
    .filter(o => o.refunds && o.refunds.length > 0)
    .flatMap(o => {
      const orderTotal = parseFloat(
        o.total_price_set?.presentment_money?.amount || o.total_price || 0
      )

      const inRange = (o.refunds || []).filter(r => {
        if (!fromTs && !toTs) return true
        if (fromTs && r.created_at < fromTs) return false
        if (toTs && r.created_at > toTs) return false
        return true
      })

      if (inRange.length === 0) return []

      const refundTotal = inRange.reduce((sum, r) =>
        sum + (r.transactions || []).reduce((ts, t) =>
          ts + parseFloat(t.amount_set?.presentment_money?.amount || t.amount || 0), 0), 0)

      if (refundTotal <= 0) return []

      const items = inRange.flatMap(r => r.refund_line_items || [])
      const productNames = [...new Set(items.map(i => i.line_item?.title).filter(Boolean))]
      const refundNote = inRange.map(r => r.note).filter(Boolean).join('; ')
      const reason = refundNote || o.cancel_reason || null
      const refundedAt = inRange.map(r => r.created_at).sort().at(-1)

      return [{
        orderId: o.name,
        orderIdNumeric: o.id,
        customer: o.customer
          ? `${o.customer.first_name || ''} ${o.customer.last_name || ''}`.trim() || 'Unknown'
          : o.email || 'Unknown',
        customerEmail: o.customer?.email || o.email || null,
        refundAmount: refundTotal.toFixed(2),
        orderTotal: orderTotal.toFixed(2),
        refundPct: orderTotal > 0 ? ((refundTotal / orderTotal) * 100).toFixed(1) : '0.0',
        itemCount: items.reduce((s, i) => s + (i.quantity || 0), 0),
        products: productNames,
        reason,
        refundedAt,
      }]
    })
    .sort((a, b) => new Date(b.refundedAt) - new Date(a.refundedAt))
}
```

- [ ] **Step 4: Add `getCustomer` function**

```js
/**
 * Look up customer by email or order number, including recent orders.
 * @param {{ domain: string, accessToken: string }} credentials
 * @param {{ email?: string, order?: string }} query
 */
export async function getCustomer(credentials, query) {
  let customer = null

  if (query.email) {
    const searchData = await shopifyFetchJSON(
      credentials,
      `/customers/search.json?query=email:${encodeURIComponent(query.email)}&limit=1`
    )
    customer = searchData.customers?.[0]
  } else if (query.order) {
    const orderName = query.order.replace(/^#/, '')
    const orderData = await shopifyFetchJSON(
      credentials,
      `/orders.json?name=${encodeURIComponent(orderName)}&status=any&limit=1`
    )
    const matchedOrder = orderData.orders?.[0]
    if (matchedOrder?.customer?.id) {
      const custData = await shopifyFetchJSON(
        credentials,
        `/customers/${matchedOrder.customer.id}.json`
      )
      customer = custData.customer
    }
  }

  if (!customer) return { customer: null, orders: [] }

  const ordersData = await shopifyFetchJSON(
    credentials,
    `/orders.json?customer_id=${customer.id}&status=any&limit=50`
  )

  const orders = (ordersData.orders || []).map(o => ({
    id: o.id,
    name: o.name,
    createdAt: o.created_at,
    financialStatus: o.financial_status,
    fulfillmentStatus: o.fulfillment_status || 'unfulfilled',
    cancelReason: o.cancel_reason,
    cancelledAt: o.cancelled_at || null,
    totalPrice: o.total_price,
    currency: o.currency,
    lineItems: (o.line_items || []).map(item => ({
      id: item.id,
      title: item.title,
      variantTitle: item.variant_title,
      sku: item.sku,
      quantity: item.quantity,
      price: item.price,
    })),
    fulfillments: (o.fulfillments || []).map(f => ({
      trackingNumber: f.tracking_number,
      trackingUrl: f.tracking_url,
      trackingCompany: f.tracking_company,
      status: f.status,
    })),
    refunds: o.refunds || [],
    shippingAddress: o.shipping_address ? {
      firstName: o.shipping_address.first_name || '',
      lastName: o.shipping_address.last_name || '',
      address1: o.shipping_address.address1 || '',
      address2: o.shipping_address.address2 || '',
      city: o.shipping_address.city || '',
      zip: o.shipping_address.zip || '',
      country: o.shipping_address.country || '',
      countryCode: o.shipping_address.country_code || '',
      phone: o.shipping_address.phone || '',
    } : null,
  }))

  return {
    customer: {
      id: customer.id,
      firstName: customer.first_name,
      lastName: customer.last_name,
      email: customer.email,
      phone: customer.phone,
      city: customer.default_address?.city,
      country: customer.default_address?.country,
      countryCode: customer.default_address?.country_code,
      ordersCount: customer.orders_count,
      totalSpent: customer.total_spent,
      currency: customer.currency,
      tags: customer.tags,
      note: customer.note,
      createdAt: customer.created_at,
    },
    orders,
  }
}
```

---

### Task 6: Add Shopify API-backed service functions — order actions + sync

**Files:**
- Modify: `lib/services/shopify.js`

- [ ] **Step 1: Add `createRefund` function**

```js
// ── Order action functions ───────────────────────────────────────────────────

/**
 * Create a refund on an order (custom amount or line-item based).
 * @param {{ domain: string, accessToken: string }} credentials
 * @param {string|number} orderId
 * @param {{ lineItems?: Array, restock?: boolean, notify?: boolean, reason?: string, shipping?: boolean, customAmount?: number }} params
 */
export async function createRefund(credentials, orderId, params) {
  const { lineItems, restock, notify, reason, shipping, customAmount } = params

  // Custom amount refund
  if (customAmount && Number(customAmount) > 0) {
    const txData = await shopifyFetchJSON(credentials, `/orders/${orderId}/transactions.json`)
    const originalTx = (txData.transactions || []).find(
      t => t.kind === 'capture' || t.kind === 'sale' || t.kind === 'authorization'
    )

    const transaction = originalTx
      ? { parent_id: originalTx.id, kind: 'refund', gateway: originalTx.gateway, amount: String(Number(customAmount).toFixed(2)) }
      : { kind: 'refund', amount: String(Number(customAmount).toFixed(2)) }

    const refundData = await shopifyFetchJSON(credentials, `/orders/${orderId}/refunds.json`, {
      method: 'POST',
      body: JSON.stringify({
        refund: { notify: notify !== false, note: reason || '', transactions: [transaction] },
      }),
    })
    return refundData.refund
  }

  // Line-item based refund
  const refundLineItems = (lineItems || []).map(item => ({
    line_item_id: item.lineItemId,
    quantity: item.quantity,
    restock_type: restock ? 'return' : 'no_restock',
  }))

  const calcData = await shopifyFetchJSON(credentials, `/orders/${orderId}/refunds/calculate.json`, {
    method: 'POST',
    body: JSON.stringify({
      refund: { shipping: { full_refund: !!shipping }, refund_line_items: refundLineItems },
    }),
  })

  const transactions = (calcData.refund?.transactions || []).map(t => ({
    parent_id: t.parent_id, amount: t.amount, kind: 'refund', gateway: t.gateway,
  }))

  const refundData = await shopifyFetchJSON(credentials, `/orders/${orderId}/refunds.json`, {
    method: 'POST',
    body: JSON.stringify({
      refund: {
        notify: notify !== false,
        note: reason || '',
        shipping: { full_refund: !!shipping },
        refund_line_items: refundLineItems,
        transactions,
      },
    }),
  })
  return refundData.refund
}
```

- [ ] **Step 2: Add `cancelOrder` function**

```js
/**
 * Cancel an order.
 * @param {{ domain: string, accessToken: string }} credentials
 * @param {string|number} orderId
 * @param {{ reason?: string, restock?: boolean, refund?: boolean, notify?: boolean }} params
 */
export async function cancelOrder(credentials, orderId, params) {
  const { reason, restock, refund, notify } = params

  const body = {
    reason: reason || 'customer',
    restock: restock !== false,
    email: notify !== false,
  }

  if (refund) {
    body.refund = { shipping: { full_refund: true }, refund_line_items: [] }
  }

  const data = await shopifyFetchJSON(credentials, `/orders/${orderId}/cancel.json`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return { id: data.order?.id, cancelReason: data.order?.cancel_reason }
}
```

- [ ] **Step 3: Add `editOrder` function**

```js
/**
 * Edit an order (three-step: begin → set quantities → commit).
 * @param {{ domain: string, accessToken: string }} credentials
 * @param {string|number} orderId
 * @param {{ lineItems: Array<{ lineItemId: string, quantity: number }>, reason?: string, notify?: boolean }} params
 */
export async function editOrder(credentials, orderId, params) {
  const { lineItems, reason, notify } = params

  // Step 1: begin edit
  const beginData = await shopifyFetchJSON(credentials, `/orders/${orderId}/edits.json`, {
    method: 'POST',
    body: JSON.stringify({}),
  })

  const editId = beginData.order_edit?.id
  if (!editId) throw new Error('No edit session returned from Shopify')

  // Step 2: set quantities
  for (const item of (lineItems || [])) {
    const setRes = await shopifyFetch(
      credentials,
      `/order_edits/${editId}/line_items/${item.lineItemId}/set_quantity.json`,
      { method: 'POST', body: JSON.stringify({ quantity: item.quantity, restock: true }) }
    )
    if (!setRes.ok) {
      const err = await setRes.json()
      console.error('[edit order] set_quantity failed:', err)
    }
  }

  // Step 3: commit
  const commitData = await shopifyFetchJSON(credentials, `/order_edits/${editId}/commit.json`, {
    method: 'POST',
    body: JSON.stringify({
      order_edit: {
        notify_customer: notify !== false,
        staff_note: reason || 'Order updated via support agent',
      },
    }),
  })

  return commitData.order_edit
}
```

- [ ] **Step 4: Add `duplicateOrder`, `updateOrderNote`, `updateOrderAddress`, `fulfillOrder` functions**

```js
/**
 * Duplicate an order by creating a draft order with copied line items.
 * @param {{ domain: string, accessToken: string }} credentials
 * @param {string|number} orderId
 * @param {{ keepAddress?: boolean, note?: string, tags?: string, discountType?: string, discountValue?: string, applyDiscount?: boolean }} params
 */
export async function duplicateOrder(credentials, orderId, params = {}) {
  const { keepAddress, note, tags, discountType, discountValue, applyDiscount } = params

  const { order } = await shopifyFetchJSON(credentials, `/orders/${orderId}.json`)

  const lineItems = (order.line_items || [])
    .map(item => {
      const base = { variant_id: item.variant_id, quantity: item.quantity }
      // Per-line-item discount copying (flat wrapper's applyDiscount behavior)
      if (applyDiscount && item.discount_allocations?.length) {
        base.applied_discount = {
          value: item.discount_allocations[0]?.amount,
          value_type: 'fixed_amount',
          title: 'Duplicated discount',
        }
      }
      return base
    })
    .filter(item => item.variant_id)

  const draftOrder = {
    line_items: lineItems,
    customer: order.customer ? { id: order.customer.id } : undefined,
    note: note || `Duplicate of ${order.name}`,
    tags: tags || order.tags,
  }

  if (discountType && discountValue && Number(discountValue) > 0) {
    draftOrder.applied_discount = {
      description: 'Discount',
      value_type: discountType === 'percentage' ? 'percentage' : 'fixed_amount',
      value: String(discountValue),
      title: discountType === 'percentage' ? `${discountValue}% discount` : `€${discountValue} discount`,
    }
  }

  if (keepAddress !== false && order.shipping_address) {
    draftOrder.shipping_address = order.shipping_address
  }

  const data = await shopifyFetchJSON(credentials, '/draft_orders.json', {
    method: 'POST',
    body: JSON.stringify({ draft_order: draftOrder }),
  })

  return {
    id: data.draft_order?.id,
    name: data.draft_order?.name,
    invoiceUrl: data.draft_order?.invoice_url,
  }
}

/**
 * Update order note and/or tags.
 * @param {{ domain: string, accessToken: string }} credentials
 * @param {string|number} orderId
 * @param {{ note?: string, tags?: string }} fields
 */
export async function updateOrderNote(credentials, orderId, fields) {
  const body = { order: { id: Number(orderId) } }
  if (fields.note !== undefined) body.order.note = fields.note
  if (fields.tags !== undefined) body.order.tags = fields.tags

  await shopifyFetchJSON(credentials, `/orders/${orderId}.json`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/**
 * Update order shipping address.
 * @param {{ domain: string, accessToken: string }} credentials
 * @param {string|number} orderId
 * @param {{ firstName: string, lastName: string, address1: string, address2?: string, city: string, zip: string, country?: string, countryCode?: string, phone?: string }} address
 */
export async function updateOrderAddress(credentials, orderId, address) {
  const data = await shopifyFetchJSON(credentials, `/orders/${orderId}.json`, {
    method: 'PUT',
    body: JSON.stringify({
      order: {
        id: orderId,
        shipping_address: {
          first_name: address.firstName,
          last_name: address.lastName,
          address1: address.address1,
          address2: address.address2 || '',
          city: address.city,
          zip: address.zip,
          country: address.country || '',
          country_code: address.countryCode || '',
          phone: address.phone || '',
        },
      },
    }),
  })

  return data.order?.shipping_address
}

/**
 * Fulfill an order by creating a fulfillment with tracking info.
 * @param {{ domain: string, accessToken: string }} credentials
 * @param {string|number} orderId
 * @param {{ trackingNumber?: string, trackingCompany?: string, trackingUrl?: string, notify?: boolean }} params
 */
export async function fulfillOrder(credentials, orderId, params = {}) {
  const { trackingNumber, trackingCompany, trackingUrl, notify } = params

  const foData = await shopifyFetchJSON(credentials, `/orders/${orderId}/fulfillment_orders.json`)
  const open = (foData.fulfillment_orders || []).filter(
    fo => fo.status === 'open' || fo.status === 'in_progress'
  )
  if (!open.length) throw new Error('No open fulfillment found')

  const body = {
    fulfillment: {
      line_items_by_fulfillment_order: open.map(fo => ({ fulfillment_order_id: fo.id })),
      notify_customer: notify !== false,
      tracking_info: trackingNumber ? {
        number: trackingNumber,
        company: trackingCompany || '',
        url: trackingUrl || '',
      } : undefined,
    },
  }

  const data = await shopifyFetchJSON(credentials, '/fulfillments.json', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return { id: data.fulfillment?.id, status: data.fulfillment?.status }
}
```

- [ ] **Step 5: Add `syncOrders` function**

```js
/**
 * Bulk sync Shopify orders into shopify_orders table.
 * @param {string} workspaceId
 * @param {{ domain: string, accessToken: string }} credentials
 * @param {string} userId - ctx.user.id for dual-write client_id
 * @param {{ full?: boolean }} options
 */
export async function syncOrders(workspaceId, credentials, userId, options = {}) {
  // Fetch + store currency
  const shopRes = await fetch(
    `https://${credentials.domain}/admin/api/${SHOPIFY_API_VERSION}/shop.json`,
    { headers: { 'X-Shopify-Access-Token': credentials.accessToken } }
  )
  if (shopRes.ok) {
    const shopData = await shopRes.json()
    const currency = shopData.shop?.currency || 'EUR'
    await supabaseAdmin.from('integrations')
      .update({ store_currency: currency })
      .eq('workspace_id', workspaceId)
  }

  // Paginate through orders
  const since = options.full
    ? ''
    : `&processed_at_min=${new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()}`

  let orders = []
  let url = `https://${credentials.domain}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&limit=250${since}`

  while (url) {
    const res = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': credentials.accessToken },
    })
    if (!res.ok) break
    const data = await res.json()
    orders = orders.concat(data.orders)
    const link = res.headers.get('link')
    const next = link?.match(/<([^>]+)>;\s*rel="next"/)
    url = next ? next[1] : null
  }

  const rows = orders.map(order => {
    const subtotal = parseFloat(
      order.subtotal_price_set?.presentment_money?.amount || order.subtotal_price || 0
    )
    const totalPrice = parseFloat(
      order.total_price_set?.presentment_money?.amount || order.total_price || 0
    )
    const totalDiscounts = parseFloat(
      order.total_discounts_set?.presentment_money?.amount || order.total_discounts || 0
    )
    const refundAmount = (order.refunds || []).reduce((sum, r) =>
      sum + (r.transactions || []).reduce((ts, t) =>
        ts + parseFloat(t.amount_set?.presentment_money?.amount || t.amount || 0), 0), 0)

    return {
      id: order.id,
      client_id: userId,
      workspace_id: workspaceId,
      order_number: order.name,
      financial_status: order.financial_status,
      cancel_reason: order.cancel_reason || null,
      subtotal_price: subtotal,
      total_price: totalPrice,
      total_discounts: totalDiscounts,
      refund_amount: refundAmount,
      presentment_currency: order.presentment_currency || order.currency || null,
      source_name: order.source_name || null,
      customer_email: order.customer?.email || order.email || null,
      customer_name: order.customer
        ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
        : null,
      processed_at: order.processed_at,
      created_at_shopify: order.created_at,
      updated_at_shopify: order.updated_at,
      synced_at: new Date().toISOString(),
    }
  })

  for (let i = 0; i < rows.length; i += 100) {
    await supabaseAdmin
      .from('shopify_orders')
      .upsert(rows.slice(i, i + 100), { onConflict: 'workspace_id,id' })
  }

  return { synced: rows.length }
}
```

---

### Task 7: Create `lib/services/refunds.js`

**Files:**
- Create: `lib/services/refunds.js`

- [ ] **Step 1: Create the module**

```js
// lib/services/refunds.js

/**
 * Map Shopify cancel_reason to standardized taxonomy value.
 */
const REASON_MAP = {
  customer: 'customer',
  fraud: 'fraud',
  inventory: 'inventory',
  declined: 'declined',
  other: 'other',
}

export function classifyRefundReason(cancelReason) {
  if (!cancelReason) return 'other'
  return REASON_MAP[cancelReason.toLowerCase()] || 'other'
}

/**
 * Group refund line items by order and calculate refund percentages.
 * @param {Array} orders - Raw Shopify orders with refunds
 * @param {{ from?: string, to?: string }} dateRange
 */
export function aggregateRefunds(orders, dateRange) {
  const fromTs = dateRange.from ? `${dateRange.from}T00:00:00` : null
  const toTs = dateRange.to ? `${dateRange.to}T23:59:59` : null

  return orders
    .filter(o => o.refunds && o.refunds.length > 0)
    .flatMap(o => {
      const orderTotal = parseFloat(o.total_price || 0)
      const inRange = (o.refunds || []).filter(r => {
        if (!fromTs && !toTs) return true
        if (fromTs && r.created_at < fromTs) return false
        if (toTs && r.created_at > toTs) return false
        return true
      })
      if (inRange.length === 0) return []

      const refundTotal = inRange.reduce((sum, r) =>
        sum + (r.transactions || []).reduce((ts, t) =>
          ts + parseFloat(t.amount || 0), 0), 0)

      if (refundTotal <= 0) return []

      return [{
        orderId: o.name,
        refundAmount: refundTotal.toFixed(2),
        orderTotal: orderTotal.toFixed(2),
        refundPct: orderTotal > 0 ? ((refundTotal / orderTotal) * 100).toFixed(1) : '0.0',
        reason: o.cancel_reason || null,
      }]
    })
}

/**
 * Aggregate refund data for AI analysis: top reasons, products, high-value.
 * @param {Array} refunds - Array of refund objects from getRefunds()
 */
export function getRefundInsights(refunds) {
  if (!refunds || refunds.length === 0) return { reasons: [], products: [], highValue: [] }

  // Top reasons
  const reasonCounts = {}
  for (const r of refunds) {
    const reason = r.reason || 'Unknown'
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1
  }
  const reasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([reason, count]) => ({ reason, count }))

  // Top refunded products
  const productCounts = {}
  for (const r of refunds) {
    for (const p of (r.products || [])) {
      productCounts[p] = (productCounts[p] || 0) + 1
    }
  }
  const products = Object.entries(productCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([product, count]) => ({ product, count }))

  // High-value refunds
  const highValue = [...refunds]
    .sort((a, b) => parseFloat(b.refundAmount) - parseFloat(a.refundAmount))
    .slice(0, 3)
    .map(r => ({
      orderId: r.orderId,
      customer: r.customer,
      refundAmount: r.refundAmount,
      reason: r.reason,
    }))

  return { reasons, products, highValue }
}
```

---

### Task 8: Create `lib/services/inbox.js`

**Files:**
- Create: `lib/services/inbox.js`

- [ ] **Step 1: Create the module**

```js
// lib/services/inbox.js
import { getAdapter } from '../providers'

/**
 * Send a reply in a thread.
 * @param {string} provider - 'gmail' | 'outlook' | 'custom'
 * @param {Object} account - Provider account credentials
 * @param {{ to: string, cc?: string[], bcc?: string[], subject: string, bodyHtml: string, bodyText: string, inReplyTo: string, references: string }} message
 */
export async function sendReply(provider, account, message) {
  const adapter = getAdapter(provider)
  const refreshed = await adapter.refreshTokenIfNeeded(account)
  return adapter.sendReply(refreshed, message)
}

/**
 * Fetch threads for a workspace.
 * @param {string} provider - 'gmail' | 'outlook' | 'custom'
 * @param {Object} account - Provider account credentials
 * @param {{ since?: string, pageToken?: string, limit?: number }} filters
 */
export async function getThreads(provider, account, filters = {}) {
  const adapter = getAdapter(provider)
  const refreshed = await adapter.refreshTokenIfNeeded(account)
  return adapter.fetchThreads(refreshed, filters)
}

/**
 * Fetch a single thread with all messages.
 * @param {string} provider - 'gmail' | 'outlook' | 'custom'
 * @param {Object} account - Provider account credentials
 * @param {string} threadId - Provider-specific thread ID
 */
export async function getThread(provider, account, threadId) {
  const adapter = getAdapter(provider)
  const refreshed = await adapter.refreshTokenIfNeeded(account)
  return adapter.fetchThread(refreshed, threadId)
}

/**
 * Mark a thread as resolved.
 * @param {string} provider - 'gmail' | 'outlook' | 'custom'
 * @param {Object} account - Provider account credentials
 * @param {string} threadId - Provider-specific thread ID
 * @param {string} agentId - Agent who resolved
 */
export async function resolveThread(provider, account, threadId, agentId) {
  // Thread resolution is handled by conversationEngine, not provider adapters.
  // This is a pass-through for Part 2 analytics instrumentation.
  const { resolveThread: resolve } = await import('../conversationEngine')
  return resolve(threadId, agentId)
}

/**
 * Send a new message (not a reply).
 * @param {string} provider - 'gmail' | 'outlook' | 'custom'
 * @param {Object} account - Provider account credentials
 * @param {{ to: string[], cc?: string[], bcc?: string[], subject: string, bodyHtml: string, bodyText: string }} message
 */
export async function sendNew(provider, account, message) {
  const adapter = getAdapter(provider)
  const refreshed = await adapter.refreshTokenIfNeeded(account)
  return adapter.sendNew(refreshed, message)
}
```

---

### Task 9: Refactor Supabase-backed API routes (kpis, revenue-trend, status)

**Files:**
- Modify: `app/api/shopify/kpis/route.js`
- Modify: `app/api/shopify/revenue-trend/route.js`
- Modify: `app/api/shopify/status/route.js`

These routes already use `getAuthContext`, so auth migration is minimal. The change is: move logic to service calls.

- [ ] **Step 1: Refactor kpis route**

Replace `app/api/shopify/kpis/route.js` with:

```js
import { getAuthContext } from '../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../lib/shopifyCredentials'
import { DEMO_SHOP, DEMO_KPIS } from '../../../../lib/demoData'
import { getKPIs } from '../../../../lib/services/shopify'
import { parseDateRange } from '../../../../lib/utils/request'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const creds = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (creds?.domain === DEMO_SHOP) return NextResponse.json(DEMO_KPIS)

  try {
    const dateRange = parseDateRange(request)
    const kpis = await getKPIs(ctx.workspaceId, dateRange)
    // Signal to frontend that initial sync is needed
    if (kpis.totalOrders === 0) kpis.needsSync = true
    return NextResponse.json(kpis)
  } catch (err) {
    console.error('[kpis] error:', err)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Refactor revenue-trend route**

Replace `app/api/shopify/revenue-trend/route.js` with:

```js
import { getAuthContext } from '../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../lib/shopifyCredentials'
import { DEMO_SHOP, DEMO_TREND } from '../../../../lib/demoData'
import { getRevenueTrend } from '../../../../lib/services/shopify'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const creds = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (creds?.domain === DEMO_SHOP) return NextResponse.json({ trend: DEMO_TREND })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to) return NextResponse.json({ trend: [] })

  try {
    const trend = await getRevenueTrend(ctx.workspaceId, { from, to })
    return NextResponse.json({ trend })
  } catch (err) {
    console.error('[revenue-trend] error:', err)
    return NextResponse.json({ trend: [] })
  }
}
```

- [ ] **Step 3: Refactor status route**

Replace `app/api/shopify/status/route.js` with:

```js
import { getAuthContext } from '../../../../lib/auth'
import { checkConnectionStatus } from '../../../../lib/services/shopify'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ connected: false })

  try {
    return NextResponse.json(await checkConnectionStatus(ctx.workspaceId))
  } catch {
    return NextResponse.json({ connected: false })
  }
}
```

---

### Task 10: Refactor data-fetching routes (orders, refunds, analytics, customer)

**Files:**
- Modify: `app/api/shopify/orders/route.js`
- Modify: `app/api/shopify/refunds/route.js`
- Modify: `app/api/shopify/analytics/route.js`
- Modify: `app/api/shopify/customer/route.js`

These routes migrate from legacy `getUserFromToken` to `getAuthContext`.

- [ ] **Step 1: Refactor orders route**

Replace `app/api/shopify/orders/route.js` with:

```js
import { getAuthContext } from '../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../lib/shopifyCredentials'
import { DEMO_SHOP, DEMO_ORDERS } from '../../../../lib/demoData'
import { getOrders, ShopifyApiError } from '../../../../lib/services/shopify'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const credentials = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })
  if (credentials.domain === DEMO_SHOP) return NextResponse.json({ orders: DEMO_ORDERS })

  try {
    const orders = await getOrders(credentials)
    return NextResponse.json({ orders })
  } catch (err) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Refactor refunds route**

Replace `app/api/shopify/refunds/route.js` with:

```js
import { getAuthContext } from '../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../lib/shopifyCredentials'
import { DEMO_SHOP, DEMO_REFUNDS } from '../../../../lib/demoData'
import { getRefunds, ShopifyApiError } from '../../../../lib/services/shopify'
import { parseDateRange } from '../../../../lib/utils/request'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const credentials = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })
  if (credentials.domain === DEMO_SHOP) return NextResponse.json({ refunds: DEMO_REFUNDS })

  try {
    const dateRange = parseDateRange(request)
    const refunds = await getRefunds(credentials, dateRange)
    return NextResponse.json({ refunds })
  } catch (err) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Failed to fetch refunds' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Refactor analytics route**

Replace `app/api/shopify/analytics/route.js` with:

```js
import { getAuthContext } from '../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../lib/shopifyCredentials'
import { getAnalytics } from '../../../../lib/services/shopify'
import { parseDateRange } from '../../../../lib/utils/request'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const credentials = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  try {
    const dateRange = parseDateRange(request)
    const result = await getAnalytics(credentials, dateRange)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Refactor customer route**

Replace `app/api/shopify/customer/route.js` with:

```js
import { getAuthContext } from '../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../lib/shopifyCredentials'
import { getCustomer, ShopifyApiError } from '../../../../lib/services/shopify'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const credentials = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  const order = searchParams.get('order')

  if (!email && !order) {
    return NextResponse.json({ error: 'Missing email or order' }, { status: 400 })
  }

  try {
    const result = await getCustomer(credentials, { email, order })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Failed to fetch customer' }, { status: 500 })
  }
}
```

---

### Task 11: Refactor order action routes ([id]/*)

**Files:**
- Modify: `app/api/shopify/orders/[id]/route.js`
- Modify: `app/api/shopify/orders/[id]/refund/route.js`
- Modify: `app/api/shopify/orders/[id]/cancel/route.js`
- Modify: `app/api/shopify/orders/[id]/edit/route.js`
- Modify: `app/api/shopify/orders/[id]/duplicate/route.js`
- Modify: `app/api/shopify/orders/[id]/note/route.js`
- Modify: `app/api/shopify/orders/[id]/address/route.js`
- Modify: `app/api/shopify/orders/[id]/fulfill/route.js`

All migrate from `getUserFromToken` + `getShopifyClient` to `getAuthContext` + `getShopifyCredentialsByWorkspace` + service calls.

- [ ] **Step 1: Refactor [id]/route.js (order detail)**

```js
import { getAuthContext } from '../../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../../lib/shopifyCredentials'
import { getOrderDetail, ShopifyApiError } from '../../../../../lib/services/shopify'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const credentials = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { id } = await params

  try {
    const order = await getOrderDetail(credentials, id)
    return NextResponse.json(order)
  } catch (err) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Refactor [id]/refund/route.js**

```js
import { getAuthContext } from '../../../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../../../lib/shopifyCredentials'
import { createRefund, ShopifyApiError } from '../../../../../../lib/services/shopify'
import { NextResponse } from 'next/server'

export async function POST(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const credentials = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { id } = await params
  const body = await request.json()

  try {
    const refund = await createRefund(credentials, id, body)
    return NextResponse.json({ success: true, refund })
  } catch (err) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Refund failed' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Refactor [id]/cancel/route.js**

```js
import { getAuthContext } from '../../../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../../../lib/shopifyCredentials'
import { cancelOrder, ShopifyApiError } from '../../../../../../lib/services/shopify'
import { NextResponse } from 'next/server'

export async function POST(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const credentials = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { id } = await params
  const body = await request.json()

  try {
    const order = await cancelOrder(credentials, id, body)
    return NextResponse.json({ success: true, order })
  } catch (err) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Cancel failed' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Refactor [id]/edit/route.js**

```js
import { getAuthContext } from '../../../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../../../lib/shopifyCredentials'
import { editOrder, ShopifyApiError } from '../../../../../../lib/services/shopify'
import { NextResponse } from 'next/server'

export async function POST(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const credentials = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { id } = await params
  const body = await request.json()

  try {
    const orderEdit = await editOrder(credentials, id, body)
    return NextResponse.json({ success: true, orderEdit })
  } catch (err) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Edit failed' }, { status: 500 })
  }
}
```

- [ ] **Step 5: Refactor [id]/duplicate/route.js**

```js
import { getAuthContext } from '../../../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../../../lib/shopifyCredentials'
import { duplicateOrder, ShopifyApiError } from '../../../../../../lib/services/shopify'
import { NextResponse } from 'next/server'

export async function POST(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const credentials = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { id } = await params
  const body = await request.json()

  try {
    const draftOrder = await duplicateOrder(credentials, id, body)
    return NextResponse.json({ success: true, draftOrder })
  } catch (err) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Duplicate failed' }, { status: 500 })
  }
}
```

- [ ] **Step 6: Refactor [id]/note/route.js**

```js
import { getAuthContext } from '../../../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../../../lib/shopifyCredentials'
import { updateOrderNote, ShopifyApiError } from '../../../../../../lib/services/shopify'
import { NextResponse } from 'next/server'

export async function PUT(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const credentials = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { id } = await params
  const body = await request.json()

  try {
    await updateOrderNote(credentials, id, body)
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }
}
```

- [ ] **Step 7: Refactor [id]/address/route.js**

```js
import { getAuthContext } from '../../../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../../../lib/shopifyCredentials'
import { updateOrderAddress, ShopifyApiError } from '../../../../../../lib/services/shopify'
import { NextResponse } from 'next/server'

export async function PUT(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const credentials = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { id } = await params
  const body = await request.json()

  try {
    const shippingAddress = await updateOrderAddress(credentials, id, body)
    return NextResponse.json({ success: true, shippingAddress })
  } catch (err) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Address update failed' }, { status: 500 })
  }
}
```

- [ ] **Step 8: Refactor [id]/fulfill/route.js**

```js
import { getAuthContext } from '../../../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../../../lib/shopifyCredentials'
import { fulfillOrder, ShopifyApiError } from '../../../../../../lib/services/shopify'
import { NextResponse } from 'next/server'

export async function POST(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const credentials = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { id } = await params
  const body = await request.json()

  try {
    const fulfillment = await fulfillOrder(credentials, id, body)
    return NextResponse.json({ success: true, fulfillment })
  } catch (err) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Fulfillment failed' }, { status: 500 })
  }
}
```

---

### Task 12: Refactor flat wrapper routes + sync route

**Files:**
- Modify: `app/api/shopify/cancel-order/route.js`
- Modify: `app/api/shopify/duplicate-order/route.js`
- Modify: `app/api/shopify/edit-address/route.js`
- Modify: `app/api/shopify/refund-order/route.js`
- Modify: `app/api/shopify/sync/route.js`

- [ ] **Step 1: Refactor cancel-order wrapper**

```js
import { getAuthContext } from '../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../lib/shopifyCredentials'
import { cancelOrder, ShopifyApiError } from '../../../../lib/services/shopify'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const credentials = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { orderId, ...params } = await request.json()
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  try {
    const order = await cancelOrder(credentials, orderId, params)
    return NextResponse.json({ success: true, order })
  } catch (err) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Cancel failed' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Refactor duplicate-order wrapper**

```js
import { getAuthContext } from '../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../lib/shopifyCredentials'
import { duplicateOrder, ShopifyApiError } from '../../../../lib/services/shopify'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const credentials = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { orderId, ...params } = await request.json()
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  try {
    const draftOrder = await duplicateOrder(credentials, orderId, params)
    return NextResponse.json({ success: true, draftOrder })
  } catch (err) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Duplicate failed' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Refactor edit-address wrapper**

```js
import { getAuthContext } from '../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../lib/shopifyCredentials'
import { updateOrderAddress, ShopifyApiError } from '../../../../lib/services/shopify'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const credentials = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { orderId, ...address } = await request.json()
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  try {
    const shippingAddress = await updateOrderAddress(credentials, orderId, address)
    return NextResponse.json({ success: true, shippingAddress })
  } catch (err) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Address update failed' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Refactor refund-order wrapper**

```js
import { getAuthContext } from '../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../lib/shopifyCredentials'
import { createRefund, ShopifyApiError } from '../../../../lib/services/shopify'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const credentials = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { orderId, ...params } = await request.json()
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  try {
    const refund = await createRefund(credentials, orderId, params)
    return NextResponse.json({ success: true, refund })
  } catch (err) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Refund failed' }, { status: 500 })
  }
}
```

- [ ] **Step 5: Refactor sync route**

Replace `app/api/shopify/sync/route.js` with:

```js
import { getAuthContext } from '../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../lib/shopifyCredentials'
import { syncOrders } from '../../../../lib/services/shopify'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!client) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const full = searchParams.get('full') === 'true'

  try {
    const result = await syncOrders(ctx.workspaceId, client, ctx.user.id, { full })
    return NextResponse.json({ success: true, synced: result.synced })
  } catch (err) {
    console.error('[sync] error:', err)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
```

---

### Task 13: Delete `lib/shopify.js`

**Files:**
- Delete: `lib/shopify.js`

- [ ] **Step 1: Verify no remaining imports of `lib/shopify.js`**

Run: `grep -r "from.*lib/shopify'" app/ lib/ --include='*.js' --include='*.ts'`

Expected: No results (all routes now use service layer). If any remain, refactor them first.

- [ ] **Step 2: Delete the file**

---

### Task 14: Create Supabase Edge Functions

**Files:**
- Create: `supabase/functions/shopify-webhook/index.ts`
- Create: `supabase/functions/shopify-sync/index.ts`

- [ ] **Step 1: Create the shopify-webhook Edge Function**

```ts
// supabase/functions/shopify-webhook/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hmac } from 'https://deno.land/x/hmac@v2.0.1/mod.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const webhookSecret = Deno.env.get('SHOPIFY_WEBHOOK_SECRET')!

const supabase = createClient(supabaseUrl, supabaseKey)

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Verify HMAC signature
  const body = await req.text()
  const hmacHeader = req.headers.get('x-shopify-hmac-sha256')
  if (!hmacHeader) {
    return new Response('Missing signature', { status: 401 })
  }

  const computed = hmac('sha256', webhookSecret, body, 'utf8', 'base64')
  if (computed !== hmacHeader) {
    return new Response('Invalid signature', { status: 401 })
  }

  const payload = JSON.parse(body)
  const topic = req.headers.get('x-shopify-topic')
  const shopDomain = req.headers.get('x-shopify-shop-domain')

  // Resolve workspace by shop domain
  const { data: integration } = await supabase
    .from('integrations')
    .select('workspace_id, client_id')
    .eq('shopify_domain', shopDomain)
    .maybeSingle()

  if (!integration) {
    console.error(`[shopify-webhook] No workspace found for domain: ${shopDomain}`)
    return new Response('Unknown shop', { status: 200 }) // 200 so Shopify doesn't retry
  }

  const { workspace_id, client_id } = integration

  if (topic === 'orders/create' || topic === 'orders/updated') {
    const order = payload
    const subtotal = parseFloat(
      order.subtotal_price_set?.presentment_money?.amount || order.subtotal_price || 0
    )
    const totalPrice = parseFloat(
      order.total_price_set?.presentment_money?.amount || order.total_price || 0
    )
    const totalDiscounts = parseFloat(
      order.total_discounts_set?.presentment_money?.amount || order.total_discounts || 0
    )
    const refundAmount = (order.refunds || []).reduce((sum: number, r: any) =>
      sum + (r.transactions || []).reduce((ts: number, t: any) =>
        ts + parseFloat(t.amount_set?.presentment_money?.amount || t.amount || 0), 0), 0)

    const row = {
      id: order.id,
      client_id,
      workspace_id,
      order_number: order.name,
      financial_status: order.financial_status,
      cancel_reason: order.cancel_reason || null,
      subtotal_price: subtotal,
      total_price: totalPrice,
      total_discounts: totalDiscounts,
      refund_amount: refundAmount,
      presentment_currency: order.presentment_currency || order.currency || null,
      source_name: order.source_name || null,
      customer_email: order.customer?.email || order.email || null,
      customer_name: order.customer
        ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
        : null,
      processed_at: order.processed_at,
      created_at_shopify: order.created_at,
      updated_at_shopify: order.updated_at,
      synced_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('shopify_orders')
      .upsert(row, { onConflict: 'workspace_id,id' })

    if (error) {
      console.error('[shopify-webhook] upsert error:', error.message)
    }
  }

  return new Response('OK', { status: 200 })
})
```

- [ ] **Step 2: Create the shopify-sync Edge Function**

```ts
// supabase/functions/shopify-sync/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

const SHOPIFY_API_VERSION = '2025-04'

Deno.serve(async () => {
  // Fetch all workspaces with active Shopify integrations
  const { data: integrations, error: intError } = await supabase
    .from('integrations')
    .select('workspace_id, shopify_domain, shopify_access_token, client_id')
    .not('shopify_access_token', 'is', null)

  if (intError || !integrations) {
    console.error('[shopify-sync] Failed to fetch integrations:', intError?.message)
    return new Response('Failed', { status: 500 })
  }

  let totalSynced = 0

  for (const int of integrations) {
    try {
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      let orders: any[] = []
      let url: string | null =
        `https://${int.shopify_domain}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&limit=250&processed_at_min=${since}`

      while (url) {
        const res = await fetch(url, {
          headers: { 'X-Shopify-Access-Token': int.shopify_access_token },
        })
        if (!res.ok) break
        const data = await res.json()
        orders = orders.concat(data.orders || [])
        const link = res.headers.get('link')
        const next = link?.match(/<([^>]+)>;\s*rel="next"/)
        url = next ? next[1] : null
      }

      const rows = orders.map((order: any) => {
        const subtotal = parseFloat(
          order.subtotal_price_set?.presentment_money?.amount || order.subtotal_price || 0
        )
        const totalPrice = parseFloat(
          order.total_price_set?.presentment_money?.amount || order.total_price || 0
        )
        const totalDiscounts = parseFloat(
          order.total_discounts_set?.presentment_money?.amount || order.total_discounts || 0
        )
        const refundAmount = (order.refunds || []).reduce((sum: number, r: any) =>
          sum + (r.transactions || []).reduce((ts: number, t: any) =>
            ts + parseFloat(t.amount_set?.presentment_money?.amount || t.amount || 0), 0), 0)

        return {
          id: order.id,
          client_id: int.client_id,
          workspace_id: int.workspace_id,
          order_number: order.name,
          financial_status: order.financial_status,
          cancel_reason: order.cancel_reason || null,
          subtotal_price: subtotal,
          total_price: totalPrice,
          total_discounts: totalDiscounts,
          refund_amount: refundAmount,
          presentment_currency: order.presentment_currency || order.currency || null,
          source_name: order.source_name || null,
          customer_email: order.customer?.email || order.email || null,
          customer_name: order.customer
            ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
            : null,
          processed_at: order.processed_at,
          created_at_shopify: order.created_at,
          updated_at_shopify: order.updated_at,
          synced_at: new Date().toISOString(),
        }
      })

      for (let i = 0; i < rows.length; i += 100) {
        await supabase
          .from('shopify_orders')
          .upsert(rows.slice(i, i + 100), { onConflict: 'workspace_id,id' })
      }

      totalSynced += rows.length
      console.log(`[shopify-sync] Synced ${rows.length} orders for workspace ${int.workspace_id}`)
    } catch (err) {
      console.error(`[shopify-sync] Error syncing workspace ${int.workspace_id}:`, err)
    }
  }

  return new Response(JSON.stringify({ success: true, totalSynced }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

---

### Task 15: Verify build and smoke test

- [ ] **Step 1: Run build to verify no import errors**

Run: `npm run build`

Expected: Build succeeds with no errors about missing imports from `lib/shopify.js` or other broken references.

- [ ] **Step 2: Verify no remaining legacy imports**

Run: `grep -r "getShopifyClient\|from.*lib/shopify'" app/ lib/ --include='*.js' --include='*.ts'`

Expected: No results.

Run: `grep -r "getUserFromToken" app/api/shopify/ --include='*.js'`

Expected: No results (all migrated to `getAuthContext`).

If build passes clean:

