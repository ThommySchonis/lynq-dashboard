// Shopify API request/response and service param types. Pure types only — no runtime code.

// ── Shopify credential shape ────────────────────────────────────────────────
export interface ShopifyCredentials {
  domain: string
  accessToken: string
}

// ── Shopify API response interfaces ─────────────────────────────────────────

export interface ShopifyCustomerRef {
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

export interface ShopifyAddress {
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

export interface ShopifyLineItem {
  id: number
  title: string
  variant_title?: string
  sku?: string
  quantity: number
  price: string
  variant_id?: number
  discount_allocations?: Array<{ amount?: string }>
}

export interface ShopifyFulfillment {
  id: number
  status: string
  tracking_number?: string
  tracking_url?: string
  tracking_company?: string
}

export interface ShopifyTransaction {
  id: number
  kind: string
  gateway?: string
  amount: string
  currency?: string
  parent_id?: number
  amount_set?: { presentment_money?: { amount?: string } }
}

export interface ShopifyRefund {
  id?: number
  created_at: string
  note?: string
  transactions?: ShopifyTransaction[]
  refund_line_items?: Array<{
    quantity?: number
    line_item?: { title?: string }
  }>
}

export interface ShopifyOrder {
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

export interface ShopifyFulfillmentOrder {
  id: number
  status: string
}

export interface ShopifyOrdersResponse { orders?: ShopifyOrder[] }
export interface ShopifySingleOrderResponse { order: ShopifyOrder }
export interface ShopifyCustomersResponse { customers?: ShopifyCustomerRef[] }
export interface ShopifySingleCustomerResponse { customer?: ShopifyCustomerRef }
export interface ShopifyTransactionsResponse { transactions?: ShopifyTransaction[] }
export interface ShopifyRefundResponse { refund?: unknown }
export interface ShopifyRefundCalcResponse { refund?: { transactions?: ShopifyTransaction[] } }
export interface ShopifyCancelResponse { order?: { id?: number; cancel_reason?: string } }
export interface ShopifyEditResponse { order_edit?: { id?: number } }
export interface ShopifyEditCommitResponse { order_edit?: unknown }
export interface ShopifyDraftOrderResponse { draft_order?: { id?: number; name?: string; invoice_url?: string } }
export interface ShopifyDraftOrderInvoiceResponse {
  draft_order_invoice?: { to?: string; subject?: string; custom_message?: string }
}
export interface DraftOrderWithInvoiceResult {
  draftOrder: { id?: number; name?: string; invoiceUrl?: string }
  invoiceSent: boolean
  invoiceError?: string
}
export interface ShopifyUpdateAddressResponse { order?: { shipping_address?: unknown } }
export interface ShopifyFulfillmentOrdersResponse { fulfillment_orders?: ShopifyFulfillmentOrder[] }
export interface ShopifyFulfillmentResponse { fulfillment?: { id?: number; status?: string } }
export interface ShopifyShopResponse { shop?: { currency?: string } }

// ── Supabase-backed service types ────────────────────────────────────────────

export interface PaginatedResult<T> {
  data: T
  nextUrl: string | null
}

export interface KPIData {
  totalOrders: number
  totalRefunds: number
  netRevenue: number
  returns: number
  cancelledOrders: number
  discounts: number
}

export interface RevenueTrendRow {
  date: string
  revenue: number | string
}

// ── Order action param interfaces ────────────────────────────────────────────

export interface RefundLineItemInput {
  lineItemId: number
  quantity: number
}

export interface CreateRefundParams {
  lineItems?: RefundLineItemInput[]
  restock?: boolean
  notify?: boolean
  reason?: string
  shipping?: boolean
  customAmount?: string | number
}

export interface CancelOrderParams {
  reason?: string
  restock?: boolean
  refund?: boolean
  notify?: boolean
}

export interface EditLineItemInput {
  lineItemId: number
  quantity: number
}

export interface EditOrderParams {
  lineItems?: EditLineItemInput[]
  reason?: string
  notify?: boolean
}

export interface DuplicateOrderParams {
  keepAddress?: boolean
  note?: string
  tags?: string
  discountType?: string
  discountValue?: string | number
  applyDiscount?: boolean
}

export interface UpdateOrderNoteFields {
  note?: string
  tags?: string
}

export interface UpdateAddressInput {
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

export interface FulfillOrderParams {
  trackingNumber?: string
  trackingCompany?: string
  trackingUrl?: string
  notify?: boolean
}

// ── Product search types ─────────────────────────────────────────────────────

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
export interface GqlProductVariantNode {
  id: string
  title: string | null
  price: string | null
  sku: string | null
  availableForSale: boolean
}
export interface GqlProductNode {
  id: string
  title: string
  featuredImage: { url: string } | null
  variants: { edges: Array<{ node: GqlProductVariantNode }> }
}
export interface GqlProductsResponse {
  data?: {
    products: {
      edges: Array<{ cursor: string; node: GqlProductNode }>
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
    }
  }
  errors?: Array<{ message: string }>
}

// ── Draft order params ───────────────────────────────────────────────────────

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
  invoiceSubject?: string
  invoiceMessage?: string
}
