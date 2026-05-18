import { supabaseAdmin } from '../supabaseAdmin'

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

// ── Internal Shopify REST helper ─────────────────────────────────────────────
const SHOPIFY_API_VERSION = '2025-04'

async function shopifyFetch(credentials: any, path: string, options: any = {}) {
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

async function shopifyFetchJSON(credentials: any, path: string, options: any = {}) {
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

// ── Supabase-backed functions ────────────────────────────────────────────────

/**
 * KPIs from shopify_orders table via PostgreSQL stored function.
 */
export async function getKPIs(
  workspaceId: string,
  dateRange: { from: string; to: string },
  storeId?: string
) {
  const { data, error } = await supabaseAdmin.rpc('get_kpis', {
    p_workspace_id: workspaceId,
    p_from: dateRange.from,
    p_to: dateRange.to,
    p_store_id: storeId || null,
  })

  if (error) throw new Error(`get_kpis RPC failed: ${error.message}`)

  const d = data as any
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

/**
 * Daily revenue trend via PostgreSQL stored function.
 */
export async function getRevenueTrend(
  workspaceId: string,
  dateRange: { from: string; to: string },
  storeId?: string
) {
  if (!dateRange.from || !dateRange.to) return []

  const { data, error } = await supabaseAdmin.rpc('get_revenue_trend', {
    p_workspace_id: workspaceId,
    p_from: dateRange.from,
    p_to: dateRange.to,
    p_store_id: storeId || null,
  })

  if (error) throw new Error(`get_revenue_trend RPC failed: ${error.message}`)

  return ((data as any[]) || []).map((row: any) => ({
    date: row.date,
    revenue: Math.max(0, Number(row.revenue) || 0),
  }))
}

/**
 * Check if Shopify credentials exist for a workspace. No API call.
 */
export async function checkConnectionStatus(workspaceId: string) {
  const { data: integration } = await supabaseAdmin
    .from('integrations')
    .select('shopify_domain')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if ((integration as any)?.shopify_domain) {
    return { connected: true, shop: (integration as any).shopify_domain }
  }
  return { connected: false }
}

/**
 * Monthly analytics via Shopify GraphQL (ShopifyQL).
 */
export async function getAnalytics(credentials: any, dateRange: { from: string; to: string }) {
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
  let data: any
  try { data = JSON.parse(text) } catch { data = text }

  return { status: res.status, raw: data }
}

// ── Shopify API-backed functions ─────────────────────────────────────────────

/**
 * Fetch recent orders from Shopify REST API.
 */
export async function getOrders(credentials: any, options: any = {}) {
  const limit = options.limit || 50
  const data = await shopifyFetchJSON(
    credentials,
    `/orders.json?status=any&limit=${limit}`
  )

  return (data.orders || []).map((o: any) => ({
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

/**
 * Fetch a single order with full details.
 */
export async function getOrderDetail(credentials: any, orderId: any) {
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
    lineItems: (order.line_items || []).map((item: any) => ({
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
    fulfillments: (order.fulfillments || []).map((f: any) => ({
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
export async function getRefunds(credentials: any, dateRange: { from: string; to: string }) {
  const from = dateRange.from
  const to = dateRange.to

  let nextUrl: string | null = `https://${credentials.domain}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&limit=250`
  if (from) nextUrl += `&updated_at_min=${from}T00:00:00`
  if (to) nextUrl += `&updated_at_max=${to}T23:59:59`

  const allOrders: any[] = []

  while (nextUrl) {
    const res: Response = await fetch(nextUrl, {
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

    const link: string | null = res.headers.get('link')
    const next: RegExpMatchArray | null | undefined = link?.match(/<([^>]+)>;\s*rel="next"/)
    nextUrl = next ? next[1] : null
  }

  const fromTs = from ? `${from}T00:00:00` : null
  const toTs = to ? `${to}T23:59:59` : null

  return allOrders
    .filter((o: any) => o.refunds && o.refunds.length > 0)
    .flatMap((o: any) => {
      const orderTotal = parseFloat(
        o.total_price_set?.presentment_money?.amount || o.total_price || 0
      )

      const inRange = (o.refunds || []).filter((r: any) => {
        if (!fromTs && !toTs) return true
        if (fromTs && r.created_at < fromTs) return false
        if (toTs && r.created_at > toTs) return false
        return true
      })

      if (inRange.length === 0) return []

      const refundTotal = inRange.reduce((sum: number, r: any) =>
        sum + (r.transactions || []).reduce((ts: number, t: any) =>
          ts + parseFloat(t.amount_set?.presentment_money?.amount || t.amount || 0), 0), 0)

      if (refundTotal <= 0) return []

      const items = inRange.flatMap((r: any) => r.refund_line_items || [])
      const productNames = [...new Set(items.map((i: any) => i.line_item?.title).filter(Boolean))]
      const refundNote = inRange.map((r: any) => r.note).filter(Boolean).join('; ')
      const reason = refundNote || o.cancel_reason || null
      const refundedAt = inRange.map((r: any) => r.created_at).sort().at(-1)

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
        itemCount: items.reduce((s: number, i: any) => s + (i.quantity || 0), 0),
        products: productNames,
        reason,
        refundedAt,
      }]
    })
    .sort((a: any, b: any) => new Date(b.refundedAt).getTime() - new Date(a.refundedAt).getTime())
}

/**
 * Look up customer by email or order number, including recent orders.
 */
export async function getCustomer(credentials: any, query: { email?: string; order?: string }) {
  let customer: any = null

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

  const orders = (ordersData.orders || []).map((o: any) => ({
    id: o.id,
    name: o.name,
    createdAt: o.created_at,
    financialStatus: o.financial_status,
    fulfillmentStatus: o.fulfillment_status || 'unfulfilled',
    cancelReason: o.cancel_reason,
    cancelledAt: o.cancelled_at || null,
    totalPrice: o.total_price,
    currency: o.currency,
    lineItems: (o.line_items || []).map((item: any) => ({
      id: item.id,
      title: item.title,
      variantTitle: item.variant_title,
      sku: item.sku,
      quantity: item.quantity,
      price: item.price,
    })),
    fulfillments: (o.fulfillments || []).map((f: any) => ({
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

// ── Order action functions ───────────────────────────────────────────────────

/**
 * Create a refund on an order (custom amount or line-item based).
 */
export async function createRefund(credentials: any, orderId: any, params: any) {
  const { lineItems, restock, notify, reason, shipping, customAmount } = params

  // Custom amount refund
  if (customAmount && Number(customAmount) > 0) {
    const txData = await shopifyFetchJSON(credentials, `/orders/${orderId}/transactions.json`)
    const originalTx = (txData.transactions || []).find(
      (t: any) => t.kind === 'capture' || t.kind === 'sale' || t.kind === 'authorization'
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
  const refundLineItems = (lineItems || []).map((item: any) => ({
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

  const transactions = (calcData.refund?.transactions || []).map((t: any) => ({
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

/**
 * Cancel an order.
 */
export async function cancelOrder(credentials: any, orderId: any, params: any) {
  const { reason, restock, refund, notify } = params

  const body: any = {
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

/**
 * Edit an order (three-step: begin -> set quantities -> commit).
 */
export async function editOrder(credentials: any, orderId: any, params: any) {
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

/**
 * Duplicate an order by creating a draft order with copied line items.
 */
export async function duplicateOrder(credentials: any, orderId: any, params: any = {}) {
  const { keepAddress, note, tags, discountType, discountValue, applyDiscount } = params

  const { order } = await shopifyFetchJSON(credentials, `/orders/${orderId}.json`)

  const lineItems = (order.line_items || [])
    .map((item: any) => {
      const base: any = { variant_id: item.variant_id, quantity: item.quantity }
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
    .filter((item: any) => item.variant_id)

  const draftOrder: any = {
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
 */
export async function updateOrderNote(credentials: any, orderId: any, fields: any) {
  const body: any = { order: { id: Number(orderId) } }
  if (fields.note !== undefined) body.order.note = fields.note
  if (fields.tags !== undefined) body.order.tags = fields.tags

  await shopifyFetchJSON(credentials, `/orders/${orderId}.json`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/**
 * Update order shipping address.
 */
export async function updateOrderAddress(credentials: any, orderId: any, address: any) {
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
 */
export async function fulfillOrder(credentials: any, orderId: any, params: any = {}) {
  const { trackingNumber, trackingCompany, trackingUrl, notify } = params

  const foData = await shopifyFetchJSON(credentials, `/orders/${orderId}/fulfillment_orders.json`)
  const open = (foData.fulfillment_orders || []).filter(
    (fo: any) => fo.status === 'open' || fo.status === 'in_progress'
  )
  if (!open.length) throw new Error('No open fulfillment found')

  const body = {
    fulfillment: {
      line_items_by_fulfillment_order: open.map((fo: any) => ({ fulfillment_order_id: fo.id })),
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

/**
 * Bulk sync Shopify orders into shopify_orders table.
 */
export async function syncOrders(workspaceId: string, credentials: any, userId: string, options: { full?: boolean; storeId?: string } = {}) {
  // Fetch + store currency
  const shopRes = await fetch(
    `https://${credentials.domain}/admin/api/${SHOPIFY_API_VERSION}/shop.json`,
    { headers: { 'X-Shopify-Access-Token': credentials.accessToken } }
  )
  if (shopRes.ok) {
    const shopData = await shopRes.json()
    const currency = shopData.shop?.currency || 'EUR'
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

  let orders: any[] = []
  let url: string | null = `https://${credentials.domain}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&limit=250${since}`

  while (url) {
    const res: Response = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': credentials.accessToken },
    })
    if (!res.ok) break
    const data = await res.json()
    orders = orders.concat(data.orders)
    const link: string | null = res.headers.get('link')
    const next: RegExpMatchArray | null | undefined = link?.match(/<([^>]+)>;\s*rel="next"/)
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
