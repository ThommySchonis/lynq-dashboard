// lib/services/data-export.types.ts
//
// Types shared by the export services (CSV + PDF) and their data sources.
// Numeric fields are `number | string` because live RPC/Shopify data returns
// numbers while the demo datasets store some values as strings; all consumers
// coerce with Number(...).

export interface ExportKPI {
  totalOrders: number | string
  totalRefunds: number | string
  netRevenue: number | string
  returns: number | string
  cancelledOrders: number | string
  discounts: number | string
}

export interface ExportTrendPoint {
  date: string
  revenue: number | string
}

export interface ExportLineItem {
  title: string
  quantity: number
  price: number | string
  sku?: string
  variantTitle?: string
}

// One refund row, matching the shape returned by getRefunds() and DEMO_REFUNDS.
export interface RefundRecord {
  orderId: string
  customer: string
  customerEmail: string | null
  refundAmount: number | string
  refundPct: number | string
  refundedAt: string | null
  products: string[]
  reason: string | null
}

// One order flattened for export, with live line items and derived refund fields.
export interface OrderWithLineItems {
  orderNumber: string
  createdAt: string
  customer: string
  customerEmail: string | null
  financialStatus: string
  fulfillmentStatus: string
  totalPrice: number | string
  cancelReason: string | null
  refundAmount: number
  refundReason: string | null
  refundedAt: string | null
  lineItems: ExportLineItem[]
}

export interface AnalyticsInputs {
  kpi: ExportKPI
  trend: ExportTrendPoint[]
  refunds: RefundRecord[]
}
