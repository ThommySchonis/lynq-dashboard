import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'
import { shopifyPaginatedFetch, SHOPIFY_API_VERSION, ShopifyApiError } from './shopify-core'
import { shopifyGraphQL } from './shopify-graphql'
import type {
  ShopifyCredentials,
  ShopifyOrder,
  ShopifyLineItem,
  ShopifyRefund,
  ShopifyTransaction,
  ShopifyOrdersResponse,
  PaginatedResult,
} from './shopify-types'
import type { OrderWithLineItems } from '@/lib/services/data-export.types'

// ── GraphQL Admin API: orders ────────────────────────────────────────────────
// getOrders / getOrderDetail read via the GraphQL Admin API (REST orders are
// deprecated). The mapping below reproduces the EXACT return shape the REST
// implementation produced: numeric ids (extracted from global ids), lowercased
// REST-equivalent status strings, shop-currency money amounts as strings, and
// the snake_case address / refund shapes REST passed through untouched.

interface GqlMoney {
  amount: string
}
interface GqlMoneyBag {
  shopMoney: GqlMoney
}
// Refund/refund-total money bags also carry presentmentMoney (customer/checkout
// currency) — the original REST getRefunds preferred presentment_money over the
// shop-currency field, so refund amounts and the order total they're divided by
// must both read presentment-first to reproduce the original refundPct math.
interface GqlMoneyBagWithPresentment extends GqlMoneyBag {
  presentmentMoney?: GqlMoney
}

// Shared GraphQL Refund node shape — used by both getOrderDetail's `order.refunds`
// and getRefunds' `orders.edges[].node.refunds` selections, and mapped by the
// single mapGqlRefund() helper below so both stay in sync.
interface GqlRefundNode {
  id: string
  createdAt: string
  note: string | null
  transactions: {
    edges: Array<{
      node: { id: string; kind: string; gateway: string | null; amountSet: GqlMoneyBagWithPresentment }
    }>
  }
  refundLineItems: {
    edges: Array<{ node: { quantity: number; lineItem: { title: string } | null } }>
  }
}
interface GqlOrdersListNode {
  id: string
  name: string
  createdAt: string
  displayFinancialStatus: string | null
  displayFulfillmentStatus: string
  cancelReason: string | null
  totalPriceSet: GqlMoneyBag
  customer: { firstName: string | null; lastName: string | null } | null
  refunds: Array<{ id: string }>
}
interface GqlOrdersListResponse {
  orders: { edges: Array<{ node: GqlOrdersListNode }> }
}

interface GqlAddress {
  firstName: string | null
  lastName: string | null
  address1: string | null
  address2: string | null
  city: string | null
  province: string | null
  provinceCode: string | null
  zip: string | null
  country: string | null
  countryCode: string | null
  phone: string | null
  company: string | null
  name: string | null
}
interface GqlOrderDetailNode {
  id: string
  name: string
  createdAt: string
  displayFinancialStatus: string | null
  displayFulfillmentStatus: string
  cancelReason: string | null
  cancelledAt: string | null
  currencyCode: string
  tags: string[]
  note: string | null
  customer: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string | null
    phone: string | null
    numberOfOrders: string
    amountSpent: GqlMoney
  } | null
  shippingAddress: GqlAddress | null
  billingAddress: GqlAddress | null
  lineItems: {
    edges: Array<{
      node: {
        id: string
        title: string
        variantTitle: string | null
        sku: string | null
        quantity: number
        originalUnitPriceSet: GqlMoneyBag
      }
    }>
  }
  subtotalPriceSet: GqlMoneyBag | null
  totalShippingPriceSet: GqlMoneyBag | null
  totalTaxSet: GqlMoneyBag | null
  totalPriceSet: GqlMoneyBag
  refunds: GqlRefundNode[]
  fulfillments: Array<{
    id: string
    status: string
    trackingInfo: Array<{ number: string | null; url: string | null; company: string | null }>
  }>
}
interface GqlOrderDetailResponse {
  order: GqlOrderDetailNode | null
}

// gid://shopify/Order/1234 -> 1234 (REST exposed numeric ids, not global ids).
function legacyIdNum(gid: string): number {
  const tail = gid.split('/').pop() ?? ''
  return Number(tail.split('?')[0])
}

// GraphQL displayFulfillmentStatus (UPPERCASE, more granular) -> the REST
// fulfillment_status vocabulary the callers expect. REST only ever produced
// null (-> 'unfulfilled'), 'fulfilled', 'partial' and 'restocked'.
function mapFulfillmentStatus(status: string): string {
  switch (status) {
    case 'FULFILLED':
      return 'fulfilled'
    case 'PARTIALLY_FULFILLED':
      return 'partial'
    case 'RESTOCKED':
      return 'restocked'
    default:
      return 'unfulfilled'
  }
}

// A refund mapped from GraphQL into the REST snake_case shape (transaction
// `amount` prefers presentment (checkout-currency) MoneyV2 amount, falling back
// to shopMoney — matching the original REST `amount_set.presentment_money || amount`).
interface MappedRefund {
  id: number
  created_at: string
  note: string | null
  transactions: Array<{ id: number; kind: string; gateway: string | null; amount: string }>
  refund_line_items: Array<{ quantity: number; line_item: { title: string } | null }>
}

// GraphQL Refund -> REST snake_case shape. Shared by getOrderDetail and getRefunds
// so both stay consistent (gid extraction, kind lowercasing, presentment-first amounts).
function mapGqlRefund(r: GqlRefundNode): MappedRefund {
  return {
    id: legacyIdNum(r.id),
    created_at: r.createdAt,
    note: r.note,
    transactions: r.transactions.edges.map(({ node: t }) => ({
      id: legacyIdNum(t.id),
      kind: t.kind.toLowerCase(),
      gateway: t.gateway,
      amount: t.amountSet.presentmentMoney?.amount || t.amountSet.shopMoney.amount,
    })),
    refund_line_items: r.refundLineItems.edges.map(({ node: rli }) => ({
      quantity: rli.quantity,
      line_item: rli.lineItem ? { title: rli.lineItem.title } : null,
    })),
  }
}

// GraphQL MailingAddress (camelCase) -> the snake_case shape REST passed through.
function mapAddress(a: GqlAddress | null): Record<string, string | null> | null {
  if (!a) return null
  return {
    first_name: a.firstName,
    last_name: a.lastName,
    address1: a.address1,
    address2: a.address2,
    city: a.city,
    province: a.province,
    province_code: a.provinceCode,
    zip: a.zip,
    country: a.country,
    country_code: a.countryCode,
    phone: a.phone,
    company: a.company,
    name: a.name,
  }
}

const GET_ORDERS_QUERY = `
  query GetOrders($first: Int!) {
    orders(first: $first, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          name
          createdAt
          displayFinancialStatus
          displayFulfillmentStatus
          cancelReason
          totalPriceSet { shopMoney { amount } }
          customer { firstName lastName }
          refunds { id }
        }
      }
    }
  }
`

const GET_ORDER_DETAIL_QUERY = `
  query GetOrderDetail($id: ID!) {
    order(id: $id) {
      id
      name
      createdAt
      displayFinancialStatus
      displayFulfillmentStatus
      cancelReason
      cancelledAt
      currencyCode
      tags
      note
      customer {
        id
        firstName
        lastName
        email
        phone
        numberOfOrders
        amountSpent { amount }
      }
      shippingAddress { firstName lastName address1 address2 city province provinceCode zip country countryCode phone company name }
      billingAddress { firstName lastName address1 address2 city province provinceCode zip country countryCode phone company name }
      lineItems(first: 250) {
        edges {
          node { id title variantTitle sku quantity originalUnitPriceSet { shopMoney { amount } } }
        }
      }
      subtotalPriceSet { shopMoney { amount } }
      totalShippingPriceSet { shopMoney { amount } }
      totalTaxSet { shopMoney { amount } }
      totalPriceSet { shopMoney { amount } }
      refunds {
        id
        createdAt
        note
        transactions(first: 50) {
          edges { node { id kind gateway amountSet { shopMoney { amount } presentmentMoney { amount } } } }
        }
        refundLineItems(first: 250) {
          edges { node { quantity lineItem { title } } }
        }
      }
      fulfillments { id status trackingInfo { number url company } }
    }
  }
`

// Orders(first: 50) rather than the 250 REST used to page with — each node here
// pulls a nested refunds -> transactions/refundLineItems subtree, which is far
// costlier per-node than getOrders' flat list, so a smaller page keeps a single
// request comfortably under Shopify's GraphQL query cost cap. Cursor pagination
// (pageInfo.hasNextPage/endCursor) makes the extra round-trips transparent.
const REFUNDS_PAGE_SIZE = 50

const GET_REFUNDS_QUERY = `
  query GetRefunds($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query) {
      edges {
        node {
          id
          name
          email
          cancelReason
          totalPriceSet { shopMoney { amount } presentmentMoney { amount } }
          customer { firstName lastName email }
          refunds {
            id
            createdAt
            note
            transactions(first: 50) {
              edges { node { id kind gateway amountSet { shopMoney { amount } presentmentMoney { amount } } } }
            }
            refundLineItems(first: 250) {
              edges { node { quantity lineItem { title } } }
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`

/**
 * Fetch recent orders from Shopify via the GraphQL Admin API.
 * Returns the same shape the former REST implementation produced.
 */
export async function getOrders(credentials: ShopifyCredentials, options: { limit?: number } = {}) {
  const limit = options.limit || 50
  const data = await shopifyGraphQL<GqlOrdersListResponse>(credentials, GET_ORDERS_QUERY, { first: limit })

  return data.orders.edges.map(({ node }) => ({
    id: legacyIdNum(node.id),
    name: node.name,
    customer: node.customer
      ? `${node.customer.firstName ?? ''} ${node.customer.lastName ?? ''}`.trim()
      : 'Unknown',
    total: parseFloat(node.totalPriceSet?.shopMoney.amount || '0').toFixed(2),
    financialStatus: node.displayFinancialStatus ? node.displayFinancialStatus.toLowerCase() : null,
    fulfillmentStatus: mapFulfillmentStatus(node.displayFulfillmentStatus),
    cancelReason: node.cancelReason ? node.cancelReason.toLowerCase() : null,
    hasRefund: node.refunds.length > 0,
    createdAt: node.createdAt,
  }))
}

/**
 * Fetch a single order with full details via the GraphQL Admin API.
 * Returns the same shape the former REST implementation produced.
 */
export async function getOrderDetail(credentials: ShopifyCredentials, orderId: string | number) {
  const data = await shopifyGraphQL<GqlOrderDetailResponse>(credentials, GET_ORDER_DETAIL_QUERY, {
    id: `gid://shopify/Order/${orderId}`,
  })
  const order = data.order
  if (!order) throw new ShopifyApiError(`Order ${orderId} not found`, 404, 'graphql')

  return {
    id: legacyIdNum(order.id),
    name: order.name,
    createdAt: order.createdAt,
    financialStatus: order.displayFinancialStatus ? order.displayFinancialStatus.toLowerCase() : null,
    fulfillmentStatus: mapFulfillmentStatus(order.displayFulfillmentStatus),
    cancelReason: order.cancelReason ? order.cancelReason.toLowerCase() : null,
    cancelledAt: order.cancelledAt,
    customer: order.customer ? {
      id: legacyIdNum(order.customer.id),
      firstName: order.customer.firstName,
      lastName: order.customer.lastName,
      email: order.customer.email,
      phone: order.customer.phone,
      ordersCount: Number(order.customer.numberOfOrders),
      totalSpent: order.customer.amountSpent.amount,
    } : null,
    shippingAddress: mapAddress(order.shippingAddress),
    billingAddress: mapAddress(order.billingAddress),
    lineItems: order.lineItems.edges.map(({ node: item }) => ({
      id: legacyIdNum(item.id),
      title: item.title,
      variantTitle: item.variantTitle,
      sku: item.sku,
      quantity: item.quantity,
      price: item.originalUnitPriceSet.shopMoney.amount,
      total: (parseFloat(item.originalUnitPriceSet.shopMoney.amount) * item.quantity).toFixed(2),
    })),
    subtotalPrice: order.subtotalPriceSet?.shopMoney.amount,
    totalShippingPrice: order.totalShippingPriceSet?.shopMoney.amount || '0.00',
    totalTax: order.totalTaxSet?.shopMoney.amount,
    totalPrice: order.totalPriceSet.shopMoney.amount,
    currency: order.currencyCode,
    refunds: order.refunds.map(mapGqlRefund),
    fulfillments: order.fulfillments.map((f) => ({
      id: legacyIdNum(f.id),
      status: f.status ? f.status.toLowerCase() : f.status,
      trackingNumber: f.trackingInfo?.[0]?.number,
      trackingUrl: f.trackingInfo?.[0]?.url,
      trackingCompany: f.trackingInfo?.[0]?.company,
    })),
    tags: order.tags.join(', '),
    note: order.note,
  }
}

// GraphQL response shape for GET_REFUNDS_QUERY.
interface GqlRefundsOrderNode {
  id: string
  name: string
  email: string | null
  cancelReason: string | null
  totalPriceSet: GqlMoneyBagWithPresentment | null
  customer: { firstName: string | null; lastName: string | null; email: string | null } | null
  refunds: GqlRefundNode[]
}
interface GqlRefundsResponse {
  orders: {
    edges: Array<{ node: GqlRefundsOrderNode }>
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
  }
}

// Minimal order shape the refund aggregation below needs — GraphQL order nodes
// are mapped into this via mapOrderForRefunds() before aggregating.
interface RefundAggOrder {
  id: number
  name: string
  cancelReason: string | null
  email: string | null
  customer: { firstName: string | null; lastName: string | null; email: string | null } | null
  orderTotal: string
  refunds: MappedRefund[]
}

function mapOrderForRefunds(node: GqlRefundsOrderNode): RefundAggOrder {
  return {
    id: legacyIdNum(node.id),
    name: node.name,
    cancelReason: node.cancelReason ? node.cancelReason.toLowerCase() : null,
    email: node.email,
    customer: node.customer,
    orderTotal: node.totalPriceSet?.presentmentMoney?.amount || node.totalPriceSet?.shopMoney?.amount || '0',
    refunds: node.refunds.map(mapGqlRefund),
  }
}

// Shopify's GraphQL search syntax: `field:>=value field:<=value` (space-separated
// terms are implicitly ANDed). Date/time values must be quoted since the ISO
// timestamp's colons would otherwise be parsed as field:value separators.
// Verified against https://shopify.dev/docs/api/usage/search-syntax.
function buildRefundsDateQuery(from: string, to: string): string {
  const clauses: string[] = []
  if (from) clauses.push(`updated_at:>='${from}T00:00:00'`)
  if (to) clauses.push(`updated_at:<='${to}T23:59:59'`)
  return clauses.join(' ')
}

// Groups refund line items by order, filters to refunds within the date window,
// and calculates refund percentages. Shared shape/logic the former REST
// implementation used — only the order/refund source changed (GraphQL, not REST JSON).
function aggregateRefunds(orders: RefundAggOrder[], dateRange: { from: string; to: string }) {
  const { from, to } = dateRange
  const fromTs = from ? `${from}T00:00:00` : null
  const toTs = to ? `${to}T23:59:59` : null

  return orders
    .filter((o) => o.refunds.length > 0)
    .flatMap((o) => {
      const orderTotal = parseFloat(o.orderTotal || '0')

      const inRange = o.refunds.filter((r) => {
        if (!fromTs && !toTs) return true
        if (fromTs && r.created_at < fromTs) return false
        if (toTs && r.created_at > toTs) return false
        return true
      })

      if (inRange.length === 0) return []

      const refundTotal = inRange.reduce((sum, r) =>
        sum + r.transactions.reduce((ts, t) => ts + parseFloat(t.amount || '0'), 0), 0)

      if (refundTotal <= 0) return []

      const items = inRange.flatMap((r) => r.refund_line_items)
      const productNames = [...new Set(items.map((i) => i.line_item?.title).filter(Boolean))]
      const refundNote = inRange.map((r) => r.note).filter(Boolean).join('; ')
      const reason = refundNote || o.cancelReason || null
      const refundedAt = inRange.map((r) => r.created_at).sort().at(-1)

      return [{
        orderId: o.name,
        orderIdNumeric: o.id,
        customer: o.customer
          ? `${o.customer.firstName || ''} ${o.customer.lastName || ''}`.trim() || 'Unknown'
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
    .sort((a, b) => new Date(b.refundedAt ?? '').getTime() - new Date(a.refundedAt ?? '').getTime())
}

/**
 * Fetch refunds from Shopify via the GraphQL Admin API, paginating with cursors
 * and filtering by the updated_at date window. Returns the same shape the
 * former REST implementation produced.
 */
export async function getRefunds(credentials: ShopifyCredentials, dateRange: { from: string; to: string }) {
  const query = buildRefundsDateQuery(dateRange.from, dateRange.to)

  const orders: RefundAggOrder[] = []
  let after: string | null = null
  let hasNextPage = true

  while (hasNextPage) {
    const data: GqlRefundsResponse = await shopifyGraphQL<GqlRefundsResponse>(credentials, GET_REFUNDS_QUERY, {
      first: REFUNDS_PAGE_SIZE,
      after,
      query,
    })
    orders.push(...data.orders.edges.map(({ node }) => mapOrderForRefunds(node)))
    hasNextPage = data.orders.pageInfo.hasNextPage
    after = data.orders.pageInfo.endCursor
  }

  return aggregateRefunds(orders, dateRange)
}

/**
 * Fetch all orders in a date range with line items and derived refund fields,
 * flattened for export. Paginates fully (not capped like getOrders).
 */
export async function getOrdersWithLineItems(
  credentials: ShopifyCredentials,
  dateRange: { from: string; to: string },
): Promise<OrderWithLineItems[]> {
  const { from, to } = dateRange

  let nextUrl: string | null = `https://${credentials.domain}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&limit=250`
  if (from) nextUrl += `&created_at_min=${from}T00:00:00`
  if (to) nextUrl += `&created_at_max=${to}T23:59:59`

  const allOrders: ShopifyOrder[] = []
  while (nextUrl) {
    const page: PaginatedResult<ShopifyOrdersResponse> = await shopifyPaginatedFetch<ShopifyOrdersResponse>(credentials, nextUrl)
    allOrders.push(...(page.data.orders || []))
    nextUrl = page.nextUrl
  }

  return allOrders.map((o: ShopifyOrder) => {
    const refunds = o.refunds || []
    const refundAmount = refunds.reduce(
      (sum: number, r: ShopifyRefund) =>
        sum + (r.transactions || []).reduce(
          (ts: number, t: ShopifyTransaction) =>
            ts + parseFloat(t.amount_set?.presentment_money?.amount || t.amount || '0'),
          0,
        ),
      0,
    )
    const refundNote = refunds.map((r: ShopifyRefund) => r.note).filter(Boolean).join('; ')
    const refundReason = refundNote || o.cancel_reason || null
    const refundedAt = refunds.map((r: ShopifyRefund) => r.created_at).sort().at(-1) ?? null

    return {
      orderNumber: o.name,
      createdAt: o.created_at,
      customer: o.customer
        ? `${o.customer.first_name || ''} ${o.customer.last_name || ''}`.trim() || 'Unknown'
        : o.email || 'Unknown',
      customerEmail: o.customer?.email || o.email || null,
      financialStatus: o.financial_status,
      fulfillmentStatus: o.fulfillment_status || 'unfulfilled',
      totalPrice: o.total_price ?? '0',
      cancelReason: o.cancel_reason ?? null,
      refundAmount,
      refundReason,
      refundedAt,
      lineItems: (o.line_items || []).map((item: ShopifyLineItem) => ({
        title: item.title,
        quantity: item.quantity,
        price: item.price,
        sku: item.sku,
        variantTitle: item.variant_title,
      })),
    }
  })
}

/**
 * Look up customer by email or order number, including recent orders.
 */
// GraphQL shape for a customer's draft orders (REST /draft_orders.json can't
// filter by customer_id, so we use the GraphQL draftOrders connection).
interface DraftOrdersGraphQLResponse {
  data?: {
    draftOrders: {
      edges: Array<{
        node: {
          id: string
          name: string
          createdAt: string
          status: string
          totalPriceSet: { shopMoney: { amount: string; currencyCode: string } } | null
          lineItems: {
            edges: Array<{
              node: {
                id: string
                title: string | null
                variantTitle: string | null
                sku: string | null
                quantity: number
                originalUnitPriceSet: { shopMoney: { amount: string } } | null
              }
            }>
          }
          shippingAddress: {
            firstName: string | null
            lastName: string | null
            address1: string | null
            address2: string | null
            city: string | null
            zip: string | null
            country: string | null
            countryCode: string | null
            phone: string | null
          } | null
        }
      }>
    }
  }
  errors?: Array<{ message: string }>
}

const CUSTOMER_DRAFT_ORDERS_QUERY = `
  query customerDraftOrders($query: String!) {
    draftOrders(first: 50, query: $query) {
      edges {
        node {
          id
          name
          createdAt
          status
          totalPriceSet { shopMoney { amount currencyCode } }
          lineItems(first: 50) {
            edges {
              node { id title variantTitle sku quantity originalUnitPriceSet { shopMoney { amount } } }
            }
          }
          shippingAddress { firstName lastName address1 address2 city zip country countryCode phone }
        }
      }
    }
  }
`

// gid://shopify/DraftOrder/123 -> "123"
function draftLegacyId(gid: string): string {
  return gid.split('/').pop() ?? gid
}

// Fetch a customer's non-completed draft orders, mapped into the same shape as
// regular orders (with isDraft: true) so the sidebar can render them inline.
// Completed drafts are skipped — they become real orders that already appear via /orders.json.
async function getCustomerDraftOrders(credentials: ShopifyCredentials, customerId: number) {
  // shopifyGraphQL throws on any transport/GraphQL failure; draft orders are
  // best-effort here (a fetch failure just means the sidebar skips drafts),
  // so every failure mode collapses to the original `return []` fallback.
  let data: NonNullable<DraftOrdersGraphQLResponse['data']>
  try {
    data = await shopifyGraphQL<NonNullable<DraftOrdersGraphQLResponse['data']>>(
      credentials,
      CUSTOMER_DRAFT_ORDERS_QUERY,
      { query: `customer_id:${customerId}` },
    )
  } catch (err) {
    logger.error('[shopify]', 'draft orders fetch failed', { error: err instanceof Error ? err.message : String(err) })
    return []
  }

  return (data.draftOrders.edges ?? [])
    .filter(({ node }) => node.status !== 'COMPLETED')
    .map(({ node }) => ({
      id: `draft_${draftLegacyId(node.id)}`,
      name: node.name,
      createdAt: node.createdAt,
      financialStatus: 'draft',
      fulfillmentStatus: '',
      cancelReason: null,
      cancelledAt: null,
      isDraft: true,
      totalPrice: node.totalPriceSet?.shopMoney.amount ?? '0',
      currency: node.totalPriceSet?.shopMoney.currencyCode ?? '',
      lineItems: node.lineItems.edges.map(({ node: li }) => ({
        id: draftLegacyId(li.id),
        title: li.title ?? '',
        variantTitle: li.variantTitle,
        sku: li.sku,
        quantity: li.quantity,
        price: li.originalUnitPriceSet?.shopMoney.amount ?? '0',
      })),
      fulfillments: [],
      refunds: [],
      shippingAddress: node.shippingAddress
        ? {
            firstName: node.shippingAddress.firstName || '',
            lastName: node.shippingAddress.lastName || '',
            address1: node.shippingAddress.address1 || '',
            address2: node.shippingAddress.address2 || '',
            city: node.shippingAddress.city || '',
            zip: node.shippingAddress.zip || '',
            country: node.shippingAddress.country || '',
            countryCode: node.shippingAddress.countryCode || '',
            phone: node.shippingAddress.phone || '',
          }
        : null,
    }))
}

// ── GraphQL Admin API: customer lookup ───────────────────────────────────────
// getCustomer resolves a Shopify customer by email or by an order number, then
// returns that customer merged with their recent orders. The original REST
// implementation made 2-3 calls (customers/search.json, or orders.json?name= +
// customers/{id}.json) followed by an unconditional orders.json?customer_id=.
// GraphQL resolves the customer AND their orders in one round-trip per path by
// nesting the `orders` connection under `customer`/`customers`.

// Shopify's Admin GraphQL search syntax tokenizes fields like `email` — an
// unquoted `email:foo@bar.com` can match on domain fragments. Quoting forces
// an exact-match phrase, matching the docs' own example (`email:"bo.wang@example.com"`):
// https://shopify.dev/docs/api/admin-graphql/latest/queries/customers
function quoteSearchValue(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`
}

interface GqlCustomerDefaultAddress {
  firstName: string | null
  lastName: string | null
  address1: string | null
  address2: string | null
  city: string | null
  province: string | null
  country: string | null
  zip: string | null
  phone: string | null
  countryCode: string | null
}

// Address shape selected on each of the customer's orders — a narrower field
// set than GqlAddress (no province/company/name), matching what the original
// REST getCustomer's per-order shippingAddress mapping read.
interface GqlCustomerOrderAddress {
  firstName: string | null
  lastName: string | null
  address1: string | null
  address2: string | null
  city: string | null
  zip: string | null
  country: string | null
  countryCode: string | null
  phone: string | null
}

interface GqlCustomerOrderNode {
  id: string
  name: string
  createdAt: string
  displayFinancialStatus: string | null
  displayFulfillmentStatus: string
  cancelReason: string | null
  cancelledAt: string | null
  totalPriceSet: GqlMoneyBag
  currencyCode: string
  lineItems: {
    edges: Array<{
      node: {
        id: string
        title: string
        variantTitle: string | null
        sku: string | null
        quantity: number
        originalUnitPriceSet: GqlMoneyBag
      }
    }>
  }
  fulfillments: Array<{
    status: string
    trackingInfo: Array<{ number: string | null; url: string | null; company: string | null }>
  }>
  refunds: GqlRefundNode[]
  shippingAddress: GqlCustomerOrderAddress | null
}

interface GqlCustomerWithOrdersNode {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  defaultAddress: GqlCustomerDefaultAddress | null
  numberOfOrders: string
  amountSpent: { amount: string; currencyCode: string }
  tags: string[]
  note: string | null
  createdAt: string
  orders: { edges: Array<{ node: GqlCustomerOrderNode }> }
}

interface GqlCustomerSearchResponse {
  customers: { edges: Array<{ node: GqlCustomerWithOrdersNode }> }
}
interface GqlCustomerByOrderResponse {
  orders: { edges: Array<{ node: { customer: GqlCustomerWithOrdersNode | null } }> }
}

// Fields shared by the email-search and order-name-search queries below —
// interpolated into both so the customer + nested orders selection can't
// drift between the two entry points.
const CUSTOMER_WITH_ORDERS_FIELDS = `
  id
  firstName
  lastName
  email
  phone
  defaultAddress { firstName lastName address1 address2 city province country zip phone countryCode }
  numberOfOrders
  amountSpent { amount currencyCode }
  tags
  note
  createdAt
  orders(first: 50, sortKey: CREATED_AT, reverse: true) {
    edges {
      node {
        id
        name
        createdAt
        displayFinancialStatus
        displayFulfillmentStatus
        cancelReason
        cancelledAt
        totalPriceSet { shopMoney { amount } }
        currencyCode
        lineItems(first: 250) {
          edges {
            node { id title variantTitle sku quantity originalUnitPriceSet { shopMoney { amount } } }
          }
        }
        fulfillments { status trackingInfo { number url company } }
        refunds {
          id
          createdAt
          note
          transactions(first: 50) {
            edges { node { id kind gateway amountSet { shopMoney { amount } presentmentMoney { amount } } } }
          }
          refundLineItems(first: 250) {
            edges { node { quantity lineItem { title } } }
          }
        }
        shippingAddress { firstName lastName address1 address2 city zip country countryCode phone }
      }
    }
  }
`

const GET_CUSTOMER_BY_EMAIL_QUERY = `
  query GetCustomerByEmail($query: String!) {
    customers(first: 1, query: $query) {
      edges {
        node {
          ${CUSTOMER_WITH_ORDERS_FIELDS}
        }
      }
    }
  }
`

const GET_CUSTOMER_BY_ORDER_QUERY = `
  query GetCustomerByOrderName($query: String!) {
    orders(first: 1, query: $query) {
      edges {
        node {
          customer {
            ${CUSTOMER_WITH_ORDERS_FIELDS}
          }
        }
      }
    }
  }
`

// GraphQL MailingAddress (camelCase, narrow field set) -> the same camelCase
// shape the original REST getCustomer's per-order shippingAddress produced
// (only 9 fields, `|| ''` fallback — unlike mapAddress(), no province).
function mapCustomerOrderAddress(a: GqlCustomerOrderAddress | null): Record<string, string> | null {
  if (!a) return null
  return {
    firstName: a.firstName || '',
    lastName: a.lastName || '',
    address1: a.address1 || '',
    address2: a.address2 || '',
    city: a.city || '',
    zip: a.zip || '',
    country: a.country || '',
    countryCode: a.countryCode || '',
    phone: a.phone || '',
  }
}

// GraphQL Refund -> REST snake_case shape for getCustomer's per-order refunds.
// Unlike mapGqlRefund() (used by getOrderDetail/getRefunds, which explicitly
// preferred presentment_money), the original REST getCustomer passed refund
// objects straight through untouched — REST Transaction.amount is shop-currency,
// with no presentment_money override applied here. Reads shopMoney only to match.
function mapCustomerOrderRefund(r: GqlRefundNode): MappedRefund {
  return {
    id: legacyIdNum(r.id),
    created_at: r.createdAt,
    note: r.note,
    transactions: r.transactions.edges.map(({ node: t }) => ({
      id: legacyIdNum(t.id),
      kind: t.kind.toLowerCase(),
      gateway: t.gateway,
      amount: t.amountSet.shopMoney.amount,
    })),
    refund_line_items: r.refundLineItems.edges.map(({ node: rli }) => ({
      quantity: rli.quantity,
      line_item: rli.lineItem ? { title: rli.lineItem.title } : null,
    })),
  }
}

// GraphQL order node (nested under customer) -> the REST shape getCustomer's
// per-customer orders list produced. `totalPrice`/`price` read shopMoney (the
// original REST fields were bare `total_price`/`price`, not `_set.presentment_money`
// — same precedent as getOrders/getOrderDetail's bare-field mappings).
function mapCustomerOrder(node: GqlCustomerOrderNode) {
  return {
    id: legacyIdNum(node.id),
    name: node.name,
    createdAt: node.createdAt,
    financialStatus: node.displayFinancialStatus ? node.displayFinancialStatus.toLowerCase() : null,
    fulfillmentStatus: mapFulfillmentStatus(node.displayFulfillmentStatus),
    cancelReason: node.cancelReason ? node.cancelReason.toLowerCase() : null,
    cancelledAt: node.cancelledAt,
    totalPrice: node.totalPriceSet.shopMoney.amount,
    currency: node.currencyCode,
    lineItems: node.lineItems.edges.map(({ node: item }) => ({
      id: legacyIdNum(item.id),
      title: item.title,
      variantTitle: item.variantTitle,
      sku: item.sku,
      quantity: item.quantity,
      price: item.originalUnitPriceSet.shopMoney.amount,
    })),
    fulfillments: node.fulfillments.map((f) => ({
      trackingNumber: f.trackingInfo?.[0]?.number,
      trackingUrl: f.trackingInfo?.[0]?.url,
      trackingCompany: f.trackingInfo?.[0]?.company,
      status: f.status ? f.status.toLowerCase() : f.status,
    })),
    refunds: node.refunds.map(mapCustomerOrderRefund),
    shippingAddress: mapCustomerOrderAddress(node.shippingAddress),
  }
}

// GraphQL Customer -> the REST customer shape getCustomer produced. `currency`
// has no direct GraphQL Customer field (REST's was "currency of the customer's
// last order, defaults to shop currency") — sourced from amountSpent.currencyCode
// instead so it always matches the currency `totalSpent` is denominated in, which
// is what the UI pairs it with (fmtPrice(cust.totalSpent, cust.currency)).
function mapCustomer(c: GqlCustomerWithOrdersNode) {
  return {
    id: legacyIdNum(c.id),
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    city: c.defaultAddress?.city,
    country: c.defaultAddress?.country,
    countryCode: c.defaultAddress?.countryCode,
    defaultAddress: c.defaultAddress
      ? {
          firstName: c.defaultAddress.firstName,
          lastName: c.defaultAddress.lastName,
          address1: c.defaultAddress.address1,
          address2: c.defaultAddress.address2,
          city: c.defaultAddress.city,
          province: c.defaultAddress.province,
          country: c.defaultAddress.country,
          zip: c.defaultAddress.zip,
          phone: c.defaultAddress.phone,
        }
      : undefined,
    ordersCount: Number(c.numberOfOrders),
    totalSpent: c.amountSpent.amount,
    currency: c.amountSpent.currencyCode,
    tags: c.tags.join(', '),
    note: c.note,
    createdAt: c.createdAt,
  }
}

/**
 * Look up customer by email or order number, including recent orders.
 */
export async function getCustomer(credentials: ShopifyCredentials, query: { email?: string; order?: string }) {
  let customerNode: GqlCustomerWithOrdersNode | null = null

  if (query.email) {
    const data = await shopifyGraphQL<GqlCustomerSearchResponse>(credentials, GET_CUSTOMER_BY_EMAIL_QUERY, {
      query: `email:${quoteSearchValue(query.email)}`,
    })
    customerNode = data.customers.edges[0]?.node ?? null
  } else if (query.order) {
    const orderName = query.order.replace(/^#/, '')
    const data = await shopifyGraphQL<GqlCustomerByOrderResponse>(credentials, GET_CUSTOMER_BY_ORDER_QUERY, {
      query: `name:${orderName}`,
    })
    customerNode = data.orders.edges[0]?.node.customer ?? null
  }

  if (!customerNode) return { customer: null, orders: [] }

  const orders = customerNode.orders.edges.map(({ node }) => mapCustomerOrder(node))

  const draftOrders = await getCustomerDraftOrders(credentials, legacyIdNum(customerNode.id))
  const allOrders = [...orders, ...draftOrders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  return {
    customer: mapCustomer(customerNode),
    orders: allOrders,
  }
}

// ── GraphQL Admin API: bulk order sync (multi-currency) ──────────────────────
// syncOrders replaces the REST shop.json + paginated orders.json?status=any it
// used to run on install/cron. The mapping into shopify_orders is byte-identical
// to the REST version: numeric ids (gid→number), lowercased status strings, and
// — critically — money amounts preferring presentmentMoney (the customer/checkout
// currency) with a shopMoney fallback, reproducing REST's `_set.presentment_money
// || <bare field>` precedence. The bare REST field (subtotal_price, total_price,
// total_discounts, transaction.amount) is shop-currency, i.e. `_set.shopMoney`.

// Shop currency (written to integrations.store_currency; REST read shop.currency).
interface GqlSyncShopResponse {
  shop: { currencyCode: string } | null
}

interface GqlSyncOrderNode {
  id: string
  name: string
  displayFinancialStatus: string | null
  cancelReason: string | null
  sourceName: string | null
  presentmentCurrencyCode: string
  currencyCode: string
  processedAt: string
  createdAt: string
  updatedAt: string
  email: string | null
  customer: { firstName: string | null; lastName: string | null; email: string | null } | null
  subtotalPriceSet: GqlMoneyBagWithPresentment | null
  totalPriceSet: GqlMoneyBagWithPresentment
  totalDiscountsSet: GqlMoneyBagWithPresentment | null
  refunds: Array<{
    transactions: { edges: Array<{ node: { amountSet: GqlMoneyBagWithPresentment } }> }
  }>
}
interface GqlSyncOrdersResponse {
  orders: {
    edges: Array<{ node: GqlSyncOrderNode }>
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
  }
}

// Presentment (checkout) amount with shop-currency fallback — the REST-parity
// precedence used for every money field the sync writes.
function presentmentAmount(bag: GqlMoneyBagWithPresentment | null | undefined): string {
  return bag?.presentmentMoney?.amount || bag?.shopMoney?.amount || '0'
}

const SYNC_SHOP_CURRENCY_QUERY = `
  query SyncShopCurrency {
    shop { currencyCode }
  }
`

// Each order node pulls a nested refunds -> transactions subtree. That is lighter
// than getRefunds' page (which also nests refundLineItems(first: 250)); 100 keeps
// the total requested query cost within the same proven envelope as REFUNDS_PAGE_SIZE
// while halving the round-trips over a potentially large 90-day install window.
const SYNC_ORDERS_PAGE_SIZE = 100

// No status clause -> all statuses (open/closed/cancelled), reproducing REST
// `status=any`. sortKey PROCESSED_AT matches the REST processed_at ordering; row
// order is irrelevant to the upsert (onConflict workspace_id,id) either way.
const SYNC_ORDERS_QUERY = `
  query SyncOrders($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query, sortKey: PROCESSED_AT) {
      edges {
        node {
          id
          name
          displayFinancialStatus
          cancelReason
          sourceName
          presentmentCurrencyCode
          currencyCode
          processedAt
          createdAt
          updatedAt
          email
          customer { firstName lastName email }
          subtotalPriceSet { shopMoney { amount } presentmentMoney { amount } }
          totalPriceSet { shopMoney { amount } presentmentMoney { amount } }
          totalDiscountsSet { shopMoney { amount } presentmentMoney { amount } }
          refunds {
            transactions(first: 50) {
              edges { node { amountSet { shopMoney { amount } presentmentMoney { amount } } } }
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`

/**
 * Bulk sync Shopify orders into shopify_orders table (via the GraphQL Admin API).
 */
export async function syncOrders(workspaceId: string, credentials: ShopifyCredentials, userId: string, options: { full?: boolean; storeId?: string } = {}) {
  // Fetch + store currency. Best-effort: a currency-fetch failure must not abort
  // the order sync (REST guarded this with `if (shopRes.ok)`; shopifyGraphQL throws).
  try {
    const shopData = await shopifyGraphQL<GqlSyncShopResponse>(credentials, SYNC_SHOP_CURRENCY_QUERY)
    const currency = shopData.shop?.currencyCode || 'EUR'
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
  } catch (err) {
    logger.error('[shopify]', 'shop currency fetch failed', { error: err instanceof Error ? err.message : String(err) })
  }

  // Paginate through orders via GraphQL cursors. `query` filters the 90-day window
  // by processed_at (empty for a full sync). Timestamps are single-quoted so their
  // colons aren't parsed as field:value separators (Shopify search syntax).
  const query = options.full
    ? ''
    : `processed_at:>='${new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()}'`

  const orders: GqlSyncOrderNode[] = []
  let after: string | null = null
  let hasNextPage = true

  while (hasNextPage) {
    try {
      const data: GqlSyncOrdersResponse = await shopifyGraphQL<GqlSyncOrdersResponse>(credentials, SYNC_ORDERS_QUERY, {
        first: SYNC_ORDERS_PAGE_SIZE,
        after,
        query,
      })
      orders.push(...data.orders.edges.map(({ node }) => node))
      hasNextPage = data.orders.pageInfo.hasNextPage
      after = data.orders.pageInfo.endCursor
    } catch {
      break
    }
  }

  const rows = orders.map((order) => {
    const subtotal = parseFloat(presentmentAmount(order.subtotalPriceSet))
    const totalPrice = parseFloat(presentmentAmount(order.totalPriceSet))
    const totalDiscounts = parseFloat(presentmentAmount(order.totalDiscountsSet))
    const refundAmount = order.refunds.reduce((sum, r) =>
      sum + r.transactions.edges.reduce((ts, { node: t }) =>
        ts + parseFloat(presentmentAmount(t.amountSet)), 0), 0)

    return {
      id: legacyIdNum(order.id),
      client_id: userId,
      workspace_id: workspaceId,
      order_number: order.name,
      financial_status: order.displayFinancialStatus ? order.displayFinancialStatus.toLowerCase() : null,
      cancel_reason: order.cancelReason ? order.cancelReason.toLowerCase() : null,
      subtotal_price: subtotal,
      total_price: totalPrice,
      total_discounts: totalDiscounts,
      refund_amount: refundAmount,
      presentment_currency: order.presentmentCurrencyCode || order.currencyCode || null,
      source_name: order.sourceName || null,
      customer_email: order.customer?.email || order.email || null,
      customer_name: order.customer
        ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim()
        : null,
      processed_at: order.processedAt,
      created_at_shopify: order.createdAt,
      updated_at_shopify: order.updatedAt,
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
