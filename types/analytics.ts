export type DateRangeId = 'month' | '7d' | '30d' | 'lastMonth' | 'custom'

export interface DateRange {
  from: string
  to: string
}

export interface Refund {
  id: string
  orderId: string
  orderNumber: string
  customer: string
  customerEmail: string
  reason: string
  refundAmount: string | number
  refundPct: string | number
  refundedAt: string
  products: string[]
}

export interface KpiData {
  totalRevenue: number
  totalOrders: number
  refundRate: number
  refundAmount: number
  totalRefunds: number
  avgOrderValue: number
}

export interface PrevKpiData {
  totalRevenue?: number
  totalOrders?: number
  refundRate?: number
  refundAmount?: number
  totalRefunds?: number
}

export interface RevenueTrendPoint {
  date: string
  revenue: number
}

export interface PatternAction {
  id: string
  type: 'pattern'
  priority: 'high' | 'medium' | 'low'
  category: string
  product?: string
  refundCount: number
  totalAmount: string | number
  title: string
  action: string
}

export interface AiInsight {
  id: string
  title: string
  body: string
  category: string
}

export interface WeeklyReportRow {
  label: string
  refundCount: number
  totalAmount: number
  topReason: string | null
  topProduct: string | null
  isCurrentWeek: boolean
}

export interface ProductMatrixRow {
  name: string
  count: number
  amount: number
  avgPct: string
  topCat: string
}

export interface RepeatRefunder {
  customer: string
  email: string
  count: number
  totalAmount: number
  lastRefund: string
}

export interface Delta {
  pct: number
  label: string
  isNew?: boolean
}

export type RefundCategory = 'All' | 'Sizing' | 'Damaged' | 'Quality' | 'Not as described' | 'Changed mind' | 'Other'

export interface CategoryColorConfig {
  color: string
  bg: string
  border: string
  chartColor: string
}
