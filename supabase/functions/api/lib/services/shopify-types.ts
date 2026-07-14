// Shopify API request/response and service param types. Pure types only — no runtime code.

// ── Shopify credential shape ────────────────────────────────────────────────
export interface ShopifyCredentials {
  domain: string
  accessToken: string
}

// ── Draft order GraphQL result shape ──────────────────────────────────────────

export interface DraftOrderWithInvoiceResult {
  draftOrder: { id?: number; name?: string; invoiceUrl?: string }
  invoiceSent: boolean
  invoiceError?: string
}

// ── Supabase-backed service types ────────────────────────────────────────────

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
