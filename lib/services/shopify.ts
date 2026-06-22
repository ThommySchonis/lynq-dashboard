import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resilientFetch } from '@/lib/resilient-fetch'
import { logger } from '@/lib/logger'

// ── Error class ──────────────────────────────────────────────────────────────
export class ShopifyApiError extends Error {
  statusCode: number
  endpoint: string

  constructor(message: string, statusCode: number, endpoint: string) {
    super(message)
    this.name = 'ShopifyApiError'
    this.statusCode = statusCode
    this.endpoint = endpoint
  }
}

// ── Shopify credential shape ────────────────────────────────────────────────
interface ShopifyCredentials {
  domain: string
  accessToken: string
}

// ── Shopify API response interfaces ─────────────────────────────────────────

interface ShopifyCustomerRef {
  id: number
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  orders_count?: number
  total_spent?: string
  default_address?: {
    first_name?: string
    last_name?: string
    address1?: string
    address2?: string
    city?: string
    province?: string
    country?: string
    country_code?: string
    zip?: string
    phone?: string
  }
  currency?: string
  tags?: string
  note?: string
  created_at?: string
}

interface ShopifyAddress {
  first_name?: string
  last_name?: string
  address1?: string
  address2?: string
  city?: string
  province?: string
  zip?: string
  country?: string
  country_code?: string
  phone?: string
}

interface ShopifyLineItem {
  id: number
  title: string
  variant_title?: string
  sku?: string
  quantity: number
  price: string
  variant_id?: number
  discount_allocations?: Array<{ amount?: string }>
}

interface ShopifyFulfillment {
  id: number
  status: string
  tracking_number?: string
  tracking_url?: string
  tracking_company?: string
}

interface ShopifyTransaction {
  id: number
  kind: string
  gateway?: string
  amount: string
  parent_id?: number
  amount_set?: { presentment_money?: { amount?: string } }
}

interface ShopifyRefund {
  id?: number
  created_at: string
  note?: string
  transactions?: ShopifyTransaction[]
  refund_line_items?: Array<{
    quantity?: number
    line_item?: { title?: string }
  }>
}

interface ShopifyOrder {
  id: number
  name: string
  created_at: string
  updated_at?: string
  processed_at?: string
  financial_status: string
  fulfillment_status?: string | null
  cancel_reason?: string | null
  cancelled_at?: string | null
  customer?: ShopifyCustomerRef | null
  email?: string
  shipping_address?: ShopifyAddress | null
  billing_address?: ShopifyAddress | null
  line_items?: ShopifyLineItem[]
  subtotal_price?: string
  total_price?: string
  total_tax?: string
  total_price_set?: { presentment_money?: { amount?: string } }
  subtotal_price_set?: { presentment_money?: { amount?: string } }
  total_discounts?: string
  total_discounts_set?: { presentment_money?: { amount?: string } }
  total_shipping_price_set?: { shop_money?: { amount?: string } }
  currency?: string
  presentment_currency?: string
  source_name?: string
  refunds?: ShopifyRefund[]
  fulfillments?: ShopifyFulfillment[]
  tags?: string
  note?: string
}

interface ShopifyFulfillmentOrder {
  id: number
  status: string
}

// ── Shopify API response shapes (used as generics for shopifyFetchJSON) ──────

interface ShopifyOrdersResponse { orders?: ShopifyOrder[] }
interface ShopifySingleOrderResponse { order: ShopifyOrder }
interface ShopifyCustomersResponse { customers?: ShopifyCustomerRef[] }
interface ShopifySingleCustomerResponse { customer?: ShopifyCustomerRef }
interface ShopifyTransactionsResponse { transactions?: ShopifyTransaction[] }
interface ShopifyRefundResponse { refund?: unknown }
interface ShopifyRefundCalcResponse { refund?: { transactions?: ShopifyTransaction[] } }
interface ShopifyCancelResponse { order?: { id?: number; cancel_reason?: string } }
interface ShopifyEditResponse { order_edit?: { id?: number } }
interface ShopifyEditCommitResponse { order_edit?: unknown }
interface ShopifyDraftOrderResponse { draft_order?: { id?: number; name?: string; invoice_url?: string } }
interface ShopifyUpdateAddressResponse { order?: { shipping_address?: unknown } }
interface ShopifyFulfillmentOrdersResponse { fulfillment_orders?: ShopifyFulfillmentOrder[] }
interface ShopifyFulfillmentResponse { fulfillment?: { id?: number; status?: string } }
interface ShopifyShopResponse { shop?: { currency?: string } }

// ── Internal Shopify REST helper ─────────────────────────────────────────────
const SHOPIFY_API_VERSION = '2025-04'

/**
 * Paginated fetch for Shopify REST endpoints that need Link-header pagination.
 * Uses retry logic consistent with resilientFetch (429 + Retry-After handling).
 */
interface PaginatedResult<T> {
  data: T
  nextUrl: string | null
}

async function shopifyPaginatedFetch<T>(
  credentials: ShopifyCredentials,
  url: string,
): Promise<PaginatedResult<T>> {
  const MAX_RETRIES = 2
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': credentials.accessToken },
      signal: AbortSignal.timeout(10_000),
    })

    if (res.status === 429) {
      const wait = parseInt(res.headers.get('Retry-After') || '2', 10) * 1000
      await new Promise<void>((r) => setTimeout(r, wait))
      continue
    }

    if (!res.ok) {
      throw new ShopifyApiError(`Shopify paginated fetch failed`, res.status, url)
    }

    const data = (await res.json()) as T
    const link: string | null = res.headers.get('link')
    const next: RegExpMatchArray | null | undefined = link?.match(/<([^>]+)>;\s*rel="next"/)
    const nextUrl: string | null = next?.[1] ?? null
    const result: PaginatedResult<T> = { data, nextUrl }
    return result
  }

  throw new ShopifyApiError('Shopify rate limit exceeded after retries', 429, url)
}

async function shopifyFetchJSON<T = Record<string, unknown>>(credentials: ShopifyCredentials, path: string, options: RequestInit = {}): Promise<T> {
  const url = `https://${credentials.domain}/admin/api/${SHOPIFY_API_VERSION}${path}`
  const res = await resilientFetch<T>('shopify', url, {
    ...options,
    headers: {
      'X-Shopify-Access-Token': credentials.accessToken,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined ?? {}),
    },
  })
  if (!res.ok) {
    throw new ShopifyApiError(
      res.error || `Shopify API error on ${path}`,
      res.status,
      path
    )
  }
  return res.data
}

// ── Supabase-backed functions ────────────────────────────────────────────────

// Shape returned by the get_kpis RPC
interface KPIData {
  totalOrders: number
  totalRefunds: number
  netRevenue: number
  returns: number
  cancelledOrders: number
  discounts: number
}

/**
 * KPIs from shopify_orders table via PostgreSQL stored function.
 */
export async function getKPIs(
  workspaceId: string,
  dateRange: { from: string; to: string },
  storeId?: string
) {
  const rpcResult = await supabaseAdmin.rpc('get_kpis', {
    p_workspace_id: workspaceId,
    p_from: dateRange.from,
    p_to: dateRange.to,
    p_store_id: storeId || null,
  })

  if (rpcResult.error) throw new Error(`get_kpis RPC failed: ${rpcResult.error.message}`)

  const d = rpcResult.data as KPIData
  const totalOrders = d.totalOrders || 0
  const totalRefunds = d.totalRefunds || 0
  const netRevenue = d.netRevenue || 0
  const returns = d.returns || 0

  const refundRate = totalOrders > 0
    ? ((totalRefunds / totalOrders) * 100).toFixed(1)
    : '0.0'
  const refundPct = netRevenue > 0
    ? ((returns / netRevenue) * 100).toFixed(1)
    : '0.0'

  return {
    totalOrders,
    cancelledOrders: d.cancelledOrders || 0,
    totalRefunds,
    refundRate,
    refundPct,
    netRevenue: Math.round(netRevenue).toString(),
    totalRevenue: Math.round(netRevenue).toString(),
    discounts: Math.round(d.discounts || 0).toString(),
    returns: Math.round(returns).toString(),
    refundAmount: Math.round(returns).toString(),
  }
}

// Shape returned by the get_revenue_trend RPC
interface RevenueTrendRow {
  date: string
  revenue: number | string
}

/**
 * Daily revenue trend via PostgreSQL stored function.
 */
export async function getRevenueTrend(
  workspaceId: string,
  dateRange: { from: string; to: string },
  storeId?: string
) {
  if (!dateRange.from || !dateRange.to) return []

  const trendResult = await supabaseAdmin.rpc('get_revenue_trend', {
    p_workspace_id: workspaceId,
    p_from: dateRange.from,
    p_to: dateRange.to,
    p_store_id: storeId || null,
  })

  if (trendResult.error) throw new Error(`get_revenue_trend RPC failed: ${trendResult.error.message}`)

  return ((trendResult.data as RevenueTrendRow[]) || []).map((row: RevenueTrendRow) => ({
    date: row.date,
    revenue: Math.max(0, Number(row.revenue) || 0),
  }))
}

/**
 * Check if Shopify credentials exist for a workspace. No API call.
 */
export async function checkConnectionStatus(workspaceId: string) {
  const { data: integrationRow } = await supabaseAdmin
    .from('integrations')
    .select('shopify_domain')
    .eq('workspace_id', workspaceId)
    .maybeSingle<{ shopify_domain?: string }>()

  if (integrationRow?.shopify_domain) {
    return { connected: true, shop: integrationRow.shopify_domain }
  }
  return { connected: false }
}

/**
 * Monthly analytics via Shopify GraphQL (ShopifyQL).
 */
export async function getAnalytics(credentials: ShopifyCredentials, dateRange: { from: string; to: string }) {
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

  const res = await resilientFetch<unknown>(
    'shopify',
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

  if (!res.ok) {
    return { status: res.status, raw: res.error }
  }
  return { status: res.status, raw: res.data }
}

// ── Shopify API-backed functions ─────────────────────────────────────────────

/**
 * Fetch recent orders from Shopify REST API.
 */
export async function getOrders(credentials: ShopifyCredentials, options: { limit?: number } = {}) {
  const limit = options.limit || 50
  const data = await shopifyFetchJSON<ShopifyOrdersResponse>(
    credentials,
    `/orders.json?status=any&limit=${limit}`
  )

  return (data.orders || []).map((o: ShopifyOrder) => ({
    id: o.id,
    name: o.name,
    customer: o.customer
      ? `${o.customer.first_name} ${o.customer.last_name}`.trim()
      : 'Unknown',
    total: parseFloat(o.total_price || '0').toFixed(2),
    financialStatus: o.financial_status,
    fulfillmentStatus: o.fulfillment_status || 'unfulfilled',
    cancelReason: o.cancel_reason || null,
    hasRefund: o.refunds != null && o.refunds.length > 0,
    createdAt: o.created_at,
  }))
}

/**
 * Fetch a single order with full details.
 */
export async function getOrderDetail(credentials: ShopifyCredentials, orderId: string | number) {
  const { order } = await shopifyFetchJSON<ShopifySingleOrderResponse>(credentials, `/orders/${orderId}.json`)

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
    lineItems: (order.line_items || []).map((item: ShopifyLineItem) => ({
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
    fulfillments: (order.fulfillments || []).map((f: ShopifyFulfillment) => ({
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

/**
 * Fetch refunds from Shopify with pagination and date filtering.
 */
export async function getRefunds(credentials: ShopifyCredentials, dateRange: { from: string; to: string }) {
  const from = dateRange.from
  const to = dateRange.to

  let nextUrl: string | null = `https://${credentials.domain}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&limit=250`
  if (from) nextUrl += `&updated_at_min=${from}T00:00:00`
  if (to) nextUrl += `&updated_at_max=${to}T23:59:59`

  const allOrders: ShopifyOrder[] = []

  while (nextUrl) {
    const page: PaginatedResult<ShopifyOrdersResponse> = await shopifyPaginatedFetch<ShopifyOrdersResponse>(credentials, nextUrl)
    allOrders.push(...(page.data.orders || []))
    nextUrl = page.nextUrl
  }

  const fromTs = from ? `${from}T00:00:00` : null
  const toTs = to ? `${to}T23:59:59` : null

  return allOrders
    .filter((o: ShopifyOrder) => o.refunds && o.refunds.length > 0)
    .flatMap((o: ShopifyOrder) => {
      const orderTotal = parseFloat(
        o.total_price_set?.presentment_money?.amount || o.total_price || '0'
      )

      const inRange = (o.refunds || []).filter((r: ShopifyRefund) => {
        if (!fromTs && !toTs) return true
        if (fromTs && r.created_at < fromTs) return false
        if (toTs && r.created_at > toTs) return false
        return true
      })

      if (inRange.length === 0) return []

      const refundTotal = inRange.reduce((sum: number, r: ShopifyRefund) =>
        sum + (r.transactions || []).reduce((ts: number, t: ShopifyTransaction) =>
          ts + parseFloat(t.amount_set?.presentment_money?.amount || t.amount || '0'), 0), 0)

      if (refundTotal <= 0) return []

      const items = inRange.flatMap((r: ShopifyRefund) => r.refund_line_items || [])
      const productNames = [...new Set(items.map((i) => i.line_item?.title).filter(Boolean))]
      const refundNote = inRange.map((r: ShopifyRefund) => r.note).filter(Boolean).join('; ')
      const reason = refundNote || o.cancel_reason || null
      const refundedAt = inRange.map((r: ShopifyRefund) => r.created_at).sort().at(-1)

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
        itemCount: items.reduce((s: number, i) => s + (i.quantity || 0), 0),
        products: productNames,
        reason,
        refundedAt,
      }]
    })
    .sort((a, b) => new Date(b.refundedAt ?? '').getTime() - new Date(a.refundedAt ?? '').getTime())
}

/**
 * Look up customer by email or order number, including recent orders.
 */
export async function getCustomer(credentials: ShopifyCredentials, query: { email?: string; order?: string }) {
  let customer: ShopifyCustomerRef | null = null

  if (query.email) {
    const searchData = await shopifyFetchJSON<ShopifyCustomersResponse>(
      credentials,
      `/customers/search.json?query=email:${encodeURIComponent(query.email)}&limit=1`
    )
    customer = searchData.customers?.[0] ?? null
  } else if (query.order) {
    const orderName = query.order.replace(/^#/, '')
    const orderData = await shopifyFetchJSON<ShopifyOrdersResponse>(
      credentials,
      `/orders.json?name=${encodeURIComponent(orderName)}&status=any&limit=1`
    )
    const matchedOrder = orderData.orders?.[0]
    if (matchedOrder?.customer?.id) {
      const custData = await shopifyFetchJSON<ShopifySingleCustomerResponse>(
        credentials,
        `/customers/${matchedOrder.customer.id}.json`
      )
      customer = custData.customer ?? null
    }
  }

  if (!customer) return { customer: null, orders: [] }

  const ordersData = await shopifyFetchJSON<ShopifyOrdersResponse>(
    credentials,
    `/orders.json?customer_id=${customer.id}&status=any&limit=50`
  )

  const orders = (ordersData.orders || []).map((o: ShopifyOrder) => ({
    id: o.id,
    name: o.name,
    createdAt: o.created_at,
    financialStatus: o.financial_status,
    fulfillmentStatus: o.fulfillment_status || 'unfulfilled',
    cancelReason: o.cancel_reason,
    cancelledAt: o.cancelled_at || null,
    totalPrice: o.total_price,
    currency: o.currency,
    lineItems: (o.line_items || []).map((item: ShopifyLineItem) => ({
      id: item.id,
      title: item.title,
      variantTitle: item.variant_title,
      sku: item.sku,
      quantity: item.quantity,
      price: item.price,
    })),
    fulfillments: (o.fulfillments || []).map((f: ShopifyFulfillment) => ({
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
      defaultAddress: customer.default_address
        ? {
            firstName: customer.default_address.first_name,
            lastName: customer.default_address.last_name,
            address1: customer.default_address.address1,
            address2: customer.default_address.address2,
            city: customer.default_address.city,
            province: customer.default_address.province,
            country: customer.default_address.country,
            zip: customer.default_address.zip,
            phone: customer.default_address.phone,
          }
        : undefined,
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

// ── Order action functions ───────────────────────────────────────────────────

interface RefundLineItemInput {
  lineItemId: number
  quantity: number
}

interface CreateRefundParams {
  lineItems?: RefundLineItemInput[]
  restock?: boolean
  notify?: boolean
  reason?: string
  shipping?: boolean
  customAmount?: string | number
}

/**
 * Create a refund on an order (custom amount or line-item based).
 */
export async function createRefund(credentials: ShopifyCredentials, orderId: string | number, params: CreateRefundParams) {
  const { lineItems, restock, notify, reason, shipping, customAmount } = params

  // Custom amount refund
  if (customAmount && Number(customAmount) > 0) {
    const txData = await shopifyFetchJSON<ShopifyTransactionsResponse>(credentials, `/orders/${orderId}/transactions.json`)
    const originalTx = (txData.transactions || []).find(
      (t: ShopifyTransaction) => t.kind === 'capture' || t.kind === 'sale' || t.kind === 'authorization'
    )

    const transaction = originalTx
      ? { parent_id: originalTx.id, kind: 'refund', gateway: originalTx.gateway, amount: String(Number(customAmount).toFixed(2)) }
      : { kind: 'refund', amount: String(Number(customAmount).toFixed(2)) }

    const refundData = await shopifyFetchJSON<ShopifyRefundResponse>(credentials, `/orders/${orderId}/refunds.json`, {
      method: 'POST',
      body: JSON.stringify({
        refund: { notify: notify !== false, note: reason || '', transactions: [transaction] },
      }),
    })
    return refundData.refund
  }

  // Line-item based refund
  const refundLineItems = (lineItems || []).map((item: RefundLineItemInput) => ({
    line_item_id: item.lineItemId,
    quantity: item.quantity,
    restock_type: restock ? 'return' : 'no_restock',
  }))

  const calcData = await shopifyFetchJSON<ShopifyRefundCalcResponse>(credentials, `/orders/${orderId}/refunds/calculate.json`, {
    method: 'POST',
    body: JSON.stringify({
      refund: { shipping: { full_refund: !!shipping }, refund_line_items: refundLineItems },
    }),
  })

  const transactions = (calcData.refund?.transactions || []).map((t: ShopifyTransaction) => ({
    parent_id: t.parent_id, amount: t.amount, kind: 'refund', gateway: t.gateway,
  }))

  const refundData = await shopifyFetchJSON<ShopifyRefundResponse>(credentials, `/orders/${orderId}/refunds.json`, {
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

interface CancelOrderParams {
  reason?: string
  restock?: boolean
  refund?: boolean
  notify?: boolean
}

/**
 * Cancel an order.
 */
export async function cancelOrder(credentials: ShopifyCredentials, orderId: string | number, params: CancelOrderParams) {
  const { reason, restock, refund, notify } = params

  const body: Record<string, unknown> = {
    reason: reason || 'customer',
    restock: restock !== false,
    email: notify !== false,
  }

  if (refund) {
    body.refund = { shipping: { full_refund: true }, refund_line_items: [] }
  }

  const data = await shopifyFetchJSON<ShopifyCancelResponse>(credentials, `/orders/${orderId}/cancel.json`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return { id: data.order?.id, cancelReason: data.order?.cancel_reason }
}

interface EditLineItemInput {
  lineItemId: number
  quantity: number
}

interface EditOrderParams {
  lineItems?: EditLineItemInput[]
  reason?: string
  notify?: boolean
}

/**
 * Edit an order (three-step: begin -> set quantities -> commit).
 */
export async function editOrder(credentials: ShopifyCredentials, orderId: string | number, params: EditOrderParams) {
  const { lineItems, reason, notify } = params

  // Step 1: begin edit
  const beginData = await shopifyFetchJSON<ShopifyEditResponse>(credentials, `/orders/${orderId}/edits.json`, {
    method: 'POST',
    body: JSON.stringify({}),
  })

  const editId = beginData.order_edit?.id
  if (!editId) throw new Error('No edit session returned from Shopify')

  // Step 2: set quantities
  for (const item of (lineItems || [])) {
    const setRes = await resilientFetch<Record<string, unknown>>(
      'shopify',
      `https://${credentials.domain}/admin/api/${SHOPIFY_API_VERSION}/order_edits/${editId}/line_items/${item.lineItemId}/set_quantity.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': credentials.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ quantity: item.quantity, restock: true }),
      }
    )
    if (!setRes.ok) {
      logger.error('[shopify]', 'set_quantity failed', { error: setRes.error })
    }
  }

  // Step 3: commit
  const commitData = await shopifyFetchJSON<ShopifyEditCommitResponse>(credentials, `/order_edits/${editId}/commit.json`, {
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

interface DuplicateOrderParams {
  keepAddress?: boolean
  note?: string
  tags?: string
  discountType?: string
  discountValue?: string | number
  applyDiscount?: boolean
}

/**
 * Duplicate an order by creating a draft order with copied line items.
 */
export async function duplicateOrder(credentials: ShopifyCredentials, orderId: string | number, params: DuplicateOrderParams = {}) {
  const { keepAddress, note, tags, discountType, discountValue, applyDiscount } = params

  const { order } = await shopifyFetchJSON<ShopifySingleOrderResponse>(credentials, `/orders/${orderId}.json`)

  const lineItems = (order.line_items || [])
    .map((item: ShopifyLineItem) => {
      const base: Record<string, unknown> = { variant_id: item.variant_id, quantity: item.quantity }
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
    .filter((item) => item.variant_id)

  const draftOrder: Record<string, unknown> = {
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
      title: discountType === 'percentage' ? `${discountValue}% discount` : `\u20AC${discountValue} discount`,
    }
  }

  if (keepAddress !== false && order.shipping_address) {
    draftOrder.shipping_address = order.shipping_address
  }

  const data = await shopifyFetchJSON<ShopifyDraftOrderResponse>(credentials, '/draft_orders.json', {
    method: 'POST',
    body: JSON.stringify({ draft_order: draftOrder }),
  })

  return {
    id: data.draft_order?.id,
    name: data.draft_order?.name,
    invoiceUrl: data.draft_order?.invoice_url,
  }
}

interface UpdateOrderNoteFields {
  note?: string
  tags?: string
}

/**
 * Update order note and/or tags.
 */
export async function updateOrderNote(credentials: ShopifyCredentials, orderId: string | number, fields: UpdateOrderNoteFields) {
  const body: { order: Record<string, unknown> } = { order: { id: Number(orderId) } }
  if (fields.note !== undefined) body.order.note = fields.note
  if (fields.tags !== undefined) body.order.tags = fields.tags

  await shopifyFetchJSON(credentials, `/orders/${orderId}.json`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

interface UpdateAddressInput {
  firstName?: string
  lastName?: string
  address1?: string
  address2?: string
  city?: string
  zip?: string
  country?: string
  countryCode?: string
  phone?: string
}

/**
 * Update order shipping address.
 */
export async function updateOrderAddress(credentials: ShopifyCredentials, orderId: string | number, address: UpdateAddressInput) {
  const data = await shopifyFetchJSON<ShopifyUpdateAddressResponse>(credentials, `/orders/${orderId}.json`, {
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

interface FulfillOrderParams {
  trackingNumber?: string
  trackingCompany?: string
  trackingUrl?: string
  notify?: boolean
}

/**
 * Fulfill an order by creating a fulfillment with tracking info.
 */
export async function fulfillOrder(credentials: ShopifyCredentials, orderId: string | number, params: FulfillOrderParams = {}) {
  const { trackingNumber, trackingCompany, trackingUrl, notify } = params

  const foData = await shopifyFetchJSON<ShopifyFulfillmentOrdersResponse>(credentials, `/orders/${orderId}/fulfillment_orders.json`)
  const open = (foData.fulfillment_orders || []).filter(
    (fo: ShopifyFulfillmentOrder) => fo.status === 'open' || fo.status === 'in_progress'
  )
  if (!open.length) throw new Error('No open fulfillment found')

  const body = {
    fulfillment: {
      line_items_by_fulfillment_order: open.map((fo: ShopifyFulfillmentOrder) => ({ fulfillment_order_id: fo.id })),
      notify_customer: notify !== false,
      tracking_info: trackingNumber ? {
        number: trackingNumber,
        company: trackingCompany || '',
        url: trackingUrl || '',
      } : undefined,
    },
  }

  const data = await shopifyFetchJSON<ShopifyFulfillmentResponse>(credentials, '/fulfillments.json', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return { id: data.fulfillment?.id, status: data.fulfillment?.status }
}

/**
 * Bulk sync Shopify orders into shopify_orders table.
 */
export async function syncOrders(workspaceId: string, credentials: ShopifyCredentials, userId: string, options: { full?: boolean; storeId?: string } = {}) {
  // Fetch + store currency
  const shopRes = await resilientFetch<ShopifyShopResponse>(
    'shopify',
    `https://${credentials.domain}/admin/api/${SHOPIFY_API_VERSION}/shop.json`,
    { headers: { 'X-Shopify-Access-Token': credentials.accessToken } }
  )
  if (shopRes.ok) {
    const currency = shopRes.data.shop?.currency || 'EUR'
    // Always write store_currency to integrations
    if (options.storeId) {
      await supabaseAdmin
        .from('integrations')
        .update({ store_currency: currency })
        .eq('store_id', options.storeId)
        .eq('workspace_id', workspaceId)
    } else {
      // Fallback: workspace-level (should not happen after migration, but safe)
      await supabaseAdmin
        .from('integrations')
        .update({ store_currency: currency })
        .eq('workspace_id', workspaceId)
    }
  }

  // Paginate through orders
  const since = options.full
    ? ''
    : `&processed_at_min=${new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()}`

  let orders: ShopifyOrder[] = []
  let url: string | null = `https://${credentials.domain}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&limit=250${since}`

  while (url) {
    try {
      const page: PaginatedResult<ShopifyOrdersResponse> = await shopifyPaginatedFetch<ShopifyOrdersResponse>(credentials, url)
      orders = orders.concat(page.data.orders || [])
      url = page.nextUrl
    } catch {
      break
    }
  }

  const rows = orders.map((order: ShopifyOrder) => {
    const subtotal = parseFloat(
      order.subtotal_price_set?.presentment_money?.amount || order.subtotal_price || '0'
    )
    const totalPrice = parseFloat(
      order.total_price_set?.presentment_money?.amount || order.total_price || '0'
    )
    const totalDiscounts = parseFloat(
      order.total_discounts_set?.presentment_money?.amount || order.total_discounts || '0'
    )
    const refundAmount = (order.refunds || []).reduce((sum: number, r: ShopifyRefund) =>
      sum + (r.transactions || []).reduce((ts: number, t: ShopifyTransaction) =>
        ts + parseFloat(t.amount_set?.presentment_money?.amount || t.amount || '0'), 0), 0)

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
      store_id: options.storeId || null,
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

export interface ProductSearchVariant {
  variantId: string
  title: string
  price: string
  sku?: string
  available: boolean
}

export interface ProductSearchResult {
  productId: string
  productTitle: string
  image?: string
  variants: ProductSearchVariant[]
}

// GraphQL node shapes for the products browse/search connection.
interface GqlProductVariantNode {
  id: string
  title: string | null
  price: string | null
  sku: string | null
  availableForSale: boolean
}
interface GqlProductNode {
  id: string
  title: string
  featuredImage: { url: string } | null
  variants: { edges: Array<{ node: GqlProductVariantNode }> }
}
interface GqlProductsResponse {
  data?: {
    products: {
      edges: Array<{ cursor: string; node: GqlProductNode }>
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
    }
  }
  errors?: Array<{ message: string }>
}

const PRODUCTS_QUERY = `
  query browseProducts($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query, sortKey: TITLE) {
      edges {
        cursor
        node {
          id
          title
          featuredImage { url }
          variants(first: 100) {
            edges {
              node { id title price sku availableForSale }
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`

// gid://shopify/ProductVariant/456 -> "456". Draft-order creation needs the
// numeric legacy id (createDraftOrder does Number(variantId)).
function legacyId(gid: string): string {
  return gid.split('/').pop() ?? gid
}

/**
 * Browse or search Shopify products via the GraphQL Admin API with cursor
 * pagination. Empty `query` browses the whole catalog; a non-empty `query`
 * filters by title. Returns one page plus the cursor for the next page.
 */
export async function searchProducts(
  credentials: ShopifyCredentials,
  query: string,
  limit = 20,
  cursor?: string | null,
): Promise<{ products: ProductSearchResult[]; nextCursor: string | null; hasNextPage: boolean }> {
  const trimmed = query.trim()
  const variables = {
    first: Math.min(Math.max(limit, 1), 50),
    after: cursor ?? null,
    query: trimmed ? `title:*${trimmed}*` : null,
  }

  const res = await resilientFetch<GqlProductsResponse>(
    'shopify',
    `https://${credentials.domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': credentials.accessToken,
      },
      body: JSON.stringify({ query: PRODUCTS_QUERY, variables }),
    },
  )

  if (!res.ok) {
    throw new ShopifyApiError(res.error, res.status, 'graphql.json:products')
  }

  if (res.data.errors?.length) {
    throw new ShopifyApiError(
      res.data.errors.map((e) => e.message).join('; '),
      res.status,
      'graphql.json:products',
    )
  }

  const conn = res.data.data?.products
  const products: ProductSearchResult[] = (conn?.edges ?? []).map(({ node }) => ({
    productId: legacyId(node.id),
    productTitle: node.title,
    image: node.featuredImage?.url,
    variants: node.variants.edges.map(({ node: v }) => ({
      variantId: legacyId(v.id),
      title: v.title || 'Default',
      price: v.price ?? '0',
      sku: v.sku || undefined,
      available: v.availableForSale,
    })),
  }))

  return {
    products,
    nextCursor: conn?.pageInfo.endCursor ?? null,
    hasNextPage: conn?.pageInfo.hasNextPage ?? false,
  }
}

export interface CreateDraftOrderParams {
  customerId?: string
  email?: string
  lineItems: Array<{ variantId: string; quantity: number }>
  shippingAddress?: {
    firstName?: string
    lastName?: string
    address1?: string
    address2?: string
    city?: string
    province?: string
    country?: string
    zip?: string
    phone?: string
  }
  discount?: {
    type: 'percentage' | 'fixed'
    value: number
  }
  note?: string
}

/**
 * Create a Shopify draft order for an existing customer.
 * Used by the inbox CreateOrderModal.
 */
export async function createDraftOrder(
  credentials: ShopifyCredentials,
  params: CreateDraftOrderParams
) {
  const email = params.email?.trim()
  if (!params.customerId && !email) {
    throw new Error('createDraftOrder requires a customer id or email')
  }

  const draftOrder: Record<string, unknown> = {
    line_items: params.lineItems.map((li) => ({
      variant_id: Number(li.variantId),
      quantity: li.quantity,
    })),
  }

  if (params.customerId) {
    draftOrder.customer = { id: Number(params.customerId) }
  } else {
    draftOrder.email = email
  }

  if (params.note) draftOrder.note = params.note

  if (params.shippingAddress) {
    const a = params.shippingAddress
    draftOrder.shipping_address = {
      first_name: a.firstName,
      last_name: a.lastName,
      address1: a.address1,
      address2: a.address2,
      city: a.city,
      province: a.province,
      country: a.country,
      zip: a.zip,
      phone: a.phone,
    }
  }

  if (params.discount) {
    draftOrder.applied_discount = {
      description: 'Discount',
      value_type:
        params.discount.type === 'percentage' ? 'percentage' : 'fixed_amount',
      value: String(params.discount.value),
      title:
        params.discount.type === 'percentage'
          ? `${params.discount.value}% discount`
          : `${params.discount.value} discount`,
    }
  }

  const data = await shopifyFetchJSON<ShopifyDraftOrderResponse>(
    credentials,
    '/draft_orders.json',
    {
      method: 'POST',
      body: JSON.stringify({ draft_order: draftOrder }),
    }
  )

  return {
    id: data.draft_order?.id,
    name: data.draft_order?.name,
    invoiceUrl: data.draft_order?.invoice_url,
  }
}
