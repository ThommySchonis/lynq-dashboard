// lib/services/data-export-pdf.tsx
//
// PDF report generation service for Orders and Analytics reports.
// Uses @react-pdf/renderer with built-in Helvetica font and the project
// color palette. Data is fetched directly from Supabase via supabaseAdmin.

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'
import React from 'react'
import { supabaseAdmin } from '../supabaseAdmin'

// ─── Types ──────────────────────────────────────────────────────────────────

interface KPIRow {
  totalOrders: number
  netRevenue: number
  totalRefunds: number
  returns: number
  cancelledOrders: number
  discounts: number
}

interface RevenueTrendRow {
  date: string
  revenue: number | string
}

interface LineItemJson {
  title: string
  quantity: number
  price: string | number
  sku?: string
  variant_title?: string
}

interface ShopifyOrderRow {
  created_at: string
  total_price: number | string
  line_items: LineItemJson[] | null
  refund_status: string | null
  refund_reason: string | null
  refund_amount: number | string | null
}

interface TopProduct {
  title: string
  orders: number
  revenue: number
}

interface MonthlyBreakdown {
  month: string
  orders: number
  revenue: number
  refunds: number
}

interface RefundReason {
  reason: string
  count: number
  amount: number
}

interface RefundProduct {
  title: string
  count: number
  amount: number
}

// ─── Color palette ──────────────────────────────────────────────────────────

const COLORS = {
  ink:      '#1C0F36',
  mutedInk: '#64748B',
  lightInk: '#94A3B8',
  border:   '#E2E8F0',
  accent:   '#A175FC',
  surface:  '#F8FAFC',
  white:    '#FFFFFF',
}

// ─── Shared styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    padding:    40,
    fontSize:   10,
    color:      COLORS.ink,
    fontFamily: 'Helvetica',
    backgroundColor: COLORS.white,
  },
  // Header
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-end',
    marginBottom:   28,
    paddingBottom:  16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  brand: {
    fontSize:    18,
    fontFamily:  'Helvetica-Bold',
    color:       COLORS.ink,
    marginBottom: 3,
  },
  brandSubtitle: {
    fontSize: 9,
    color:    COLORS.mutedInk,
  },
  reportMeta: {
    textAlign: 'right',
  },
  reportLabel: {
    fontSize:      8,
    color:         COLORS.lightInk,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom:  3,
  },
  reportTitle: {
    fontSize:   14,
    fontFamily: 'Helvetica-Bold',
    color:      COLORS.ink,
  },
  // KPI row
  kpiRow: {
    flexDirection: 'row',
    gap:           10,
    marginBottom:  28,
  },
  kpiBox: {
    flex:            1,
    backgroundColor: COLORS.surface,
    borderRadius:    6,
    padding:         12,
    borderWidth:     1,
    borderColor:     COLORS.border,
  },
  kpiLabel: {
    fontSize:     8,
    color:        COLORS.mutedInk,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  kpiValue: {
    fontSize:   14,
    fontFamily: 'Helvetica-Bold',
    color:      COLORS.ink,
  },
  // Section
  sectionTitle: {
    fontSize:      9,
    fontFamily:    'Helvetica-Bold',
    color:         COLORS.lightInk,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom:  10,
  },
  // Table
  table: {
    marginBottom: 24,
  },
  tableHeader: {
    flexDirection:     'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom:     6,
    marginBottom:      2,
    backgroundColor:   COLORS.surface,
    paddingHorizontal: 8,
    paddingTop:        6,
  },
  tableHeaderCell: {
    fontSize:      8,
    fontFamily:    'Helvetica-Bold',
    color:         COLORS.lightInk,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  tableRow: {
    flexDirection:     'row',
    paddingVertical:   7,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  tableRowAlt: {
    backgroundColor: COLORS.surface,
  },
  cell: {
    fontSize: 9,
    color:    COLORS.ink,
  },
  cellMuted: {
    fontSize: 9,
    color:    COLORS.mutedInk,
  },
  // Column widths
  colFlex4: { flex: 4 },
  colFlex2: { flex: 2 },
  colFlex1: { flex: 1, textAlign: 'right' },
  colFlex15: { flex: 1.5, textAlign: 'right' },
  // Footer
  footer: {
    position:       'absolute',
    bottom:         28,
    left:           40,
    right:          40,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop:     8,
    flexDirection:  'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color:    COLORS.lightInk,
  },
  footerAccent: {
    fontSize: 8,
    color:    COLORS.accent,
  },
})

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatEUR(amount: number): string {
  return `€${amount.toFixed(2)}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function monthLabel(iso: string): string {
  return new Date(iso + '-01').toLocaleDateString('en-GB', { year: 'numeric', month: 'short' })
}

// ─── Orders Report PDF ───────────────────────────────────────────────────────

interface OrdersReportData {
  totalOrders: number
  totalRevenue: number
  refundRate: string
  avgOrderValue: number
  topProducts: TopProduct[]
  monthlyBreakdown: MonthlyBreakdown[]
}

interface OrdersReportDocProps {
  data: OrdersReportData
  generatedAt: string
}

const OrdersReportDocument: React.FC<OrdersReportDocProps> = ({ data, generatedAt }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>Lynq &amp; Flow</Text>
          <Text style={styles.brandSubtitle}>Generated {generatedAt}</Text>
        </View>
        <View style={styles.reportMeta}>
          <Text style={styles.reportLabel}>Report</Text>
          <Text style={styles.reportTitle}>Orders &amp; Refunds Report</Text>
        </View>
      </View>

      {/* KPI boxes */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>Total Orders</Text>
          <Text style={styles.kpiValue}>{data.totalOrders.toString()}</Text>
        </View>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>Total Revenue</Text>
          <Text style={styles.kpiValue}>{formatEUR(data.totalRevenue)}</Text>
        </View>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>Refund Rate</Text>
          <Text style={styles.kpiValue}>{data.refundRate}%</Text>
        </View>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>Avg Order Value</Text>
          <Text style={styles.kpiValue}>{formatEUR(data.avgOrderValue)}</Text>
        </View>
      </View>

      {/* Top Products */}
      <Text style={styles.sectionTitle}>Top Products</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.colFlex4]}>Product</Text>
          <Text style={[styles.tableHeaderCell, styles.colFlex1]}>Orders</Text>
          <Text style={[styles.tableHeaderCell, styles.colFlex15]}>Revenue</Text>
        </View>
        {data.topProducts.map((p, idx) => (
          <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
            <Text style={[styles.cell, styles.colFlex4]}>{p.title}</Text>
            <Text style={[styles.cellMuted, styles.colFlex1]}>{p.orders}</Text>
            <Text style={[styles.cell, styles.colFlex15]}>{formatEUR(p.revenue)}</Text>
          </View>
        ))}
      </View>

      {/* Monthly Breakdown */}
      <Text style={styles.sectionTitle}>Monthly Breakdown</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.colFlex2]}>Month</Text>
          <Text style={[styles.tableHeaderCell, styles.colFlex1]}>Orders</Text>
          <Text style={[styles.tableHeaderCell, styles.colFlex15]}>Revenue</Text>
          <Text style={[styles.tableHeaderCell, styles.colFlex15]}>Refunds</Text>
        </View>
        {data.monthlyBreakdown.map((m, idx) => (
          <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
            <Text style={[styles.cell, styles.colFlex2]}>{m.month}</Text>
            <Text style={[styles.cellMuted, styles.colFlex1]}>{m.orders}</Text>
            <Text style={[styles.cell, styles.colFlex15]}>{formatEUR(m.revenue)}</Text>
            <Text style={[styles.cellMuted, styles.colFlex15]}>{formatEUR(m.refunds)}</Text>
          </View>
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerAccent}>Lynq &amp; Flow · Orders Report</Text>
        <Text style={styles.footerText}>{generatedAt}</Text>
      </View>
    </Page>
  </Document>
)

// ─── Analytics Report PDF ────────────────────────────────────────────────────

interface AnalyticsReportData {
  totalOrders: number
  revenue: number
  refunds: number
  refundRate: string
  revenueTrend: Array<{ date: string; revenue: number }>
  topRefundReasons: RefundReason[]
  topRefundProducts: RefundProduct[]
}

interface AnalyticsReportDocProps {
  data: AnalyticsReportData
  generatedAt: string
}

const AnalyticsReportDocument: React.FC<AnalyticsReportDocProps> = ({ data, generatedAt }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>Lynq &amp; Flow</Text>
          <Text style={styles.brandSubtitle}>Generated {generatedAt}</Text>
        </View>
        <View style={styles.reportMeta}>
          <Text style={styles.reportLabel}>Report</Text>
          <Text style={styles.reportTitle}>Analytics Report</Text>
        </View>
      </View>

      {/* KPI boxes */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>Total Orders</Text>
          <Text style={styles.kpiValue}>{data.totalOrders.toString()}</Text>
        </View>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>Revenue</Text>
          <Text style={styles.kpiValue}>{formatEUR(data.revenue)}</Text>
        </View>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>Refunds</Text>
          <Text style={styles.kpiValue}>{formatEUR(data.refunds)}</Text>
        </View>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>Refund Rate</Text>
          <Text style={styles.kpiValue}>{data.refundRate}%</Text>
        </View>
      </View>

      {/* Revenue Trend */}
      <Text style={styles.sectionTitle}>Revenue Trend</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.colFlex4]}>Date</Text>
          <Text style={[styles.tableHeaderCell, styles.colFlex2]}>Revenue</Text>
        </View>
        {data.revenueTrend.map((row, idx) => (
          <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
            <Text style={[styles.cell, styles.colFlex4]}>{formatDate(row.date)}</Text>
            <Text style={[styles.cell, styles.colFlex2]}>{formatEUR(row.revenue)}</Text>
          </View>
        ))}
      </View>

      {/* Top Refund Reasons */}
      <Text style={styles.sectionTitle}>Top Refund Reasons</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.colFlex4]}>Reason</Text>
          <Text style={[styles.tableHeaderCell, styles.colFlex1]}>Count</Text>
          <Text style={[styles.tableHeaderCell, styles.colFlex15]}>Amount</Text>
        </View>
        {data.topRefundReasons.map((r, idx) => (
          <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
            <Text style={[styles.cell, styles.colFlex4]}>{r.reason}</Text>
            <Text style={[styles.cellMuted, styles.colFlex1]}>{r.count}</Text>
            <Text style={[styles.cell, styles.colFlex15]}>{formatEUR(r.amount)}</Text>
          </View>
        ))}
      </View>

      {/* Top Refund Products */}
      <Text style={styles.sectionTitle}>Top Refund Products</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.colFlex4]}>Product</Text>
          <Text style={[styles.tableHeaderCell, styles.colFlex1]}>Count</Text>
          <Text style={[styles.tableHeaderCell, styles.colFlex15]}>Amount</Text>
        </View>
        {data.topRefundProducts.map((p, idx) => (
          <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
            <Text style={[styles.cell, styles.colFlex4]}>{p.title}</Text>
            <Text style={[styles.cellMuted, styles.colFlex1]}>{p.count}</Text>
            <Text style={[styles.cell, styles.colFlex15]}>{formatEUR(p.amount)}</Text>
          </View>
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerAccent}>Lynq &amp; Flow · Analytics Report</Text>
        <Text style={styles.footerText}>{generatedAt}</Text>
      </View>
    </Page>
  </Document>
)

// ─── Data fetching helpers ───────────────────────────────────────────────────

function dateRange12Months(): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  from.setMonth(from.getMonth() - 12)
  return {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
  }
}

function dateRange30Days(): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 30)
  return {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
  }
}

async function fetchKPIs(
  workspaceId: string,
  dateRange: { from: string; to: string },
  storeId?: string,
): Promise<KPIRow> {
  const rpcResult = await supabaseAdmin.rpc('get_kpis', {
    p_workspace_id: workspaceId,
    p_from:         dateRange.from,
    p_to:           dateRange.to,
    p_store_id:     storeId ?? null,
  })
  if (rpcResult.error) throw new Error(`get_kpis RPC failed: ${rpcResult.error.message}`)
  const row = rpcResult.data as KPIRow
  return {
    totalOrders:      row.totalOrders      ?? 0,
    netRevenue:       row.netRevenue       ?? 0,
    totalRefunds:     row.totalRefunds     ?? 0,
    returns:          row.returns          ?? 0,
    cancelledOrders:  row.cancelledOrders  ?? 0,
    discounts:        row.discounts        ?? 0,
  }
}

async function fetchRevenueTrend(
  workspaceId: string,
  dateRange: { from: string; to: string },
  storeId?: string,
): Promise<Array<{ date: string; revenue: number }>> {
  const trendResult = await supabaseAdmin.rpc('get_revenue_trend', {
    p_workspace_id: workspaceId,
    p_from:         dateRange.from,
    p_to:           dateRange.to,
    p_store_id:     storeId ?? null,
  })
  if (trendResult.error) throw new Error(`get_revenue_trend RPC failed: ${trendResult.error.message}`)
  return ((trendResult.data as RevenueTrendRow[]) ?? []).map((row) => ({
    date:    row.date,
    revenue: Math.max(0, Number(row.revenue) || 0),
  }))
}

async function fetchOrders(workspaceId: string, storeId?: string): Promise<ShopifyOrderRow[]> {
  let query = supabaseAdmin
    .from('shopify_orders')
    .select('created_at, total_price, line_items, refund_status, refund_reason, refund_amount')
    .eq('workspace_id', workspaceId)
    .eq('is_demo', false)

  if (storeId) {
    query = query.eq('store_id', storeId)
  }

  const { data, error } = await query
  if (error) throw new Error(`shopify_orders query failed: ${error.message}`)
  return (data as ShopifyOrderRow[]) ?? []
}

// ─── Orders report data assembly ─────────────────────────────────────────────

async function buildOrdersReportData(workspaceId: string, storeId?: string): Promise<OrdersReportData> {
  const range = dateRange12Months()
  const [kpis, orders] = await Promise.all([
    fetchKPIs(workspaceId, range, storeId),
    fetchOrders(workspaceId, storeId),
  ])

  const totalOrders = kpis.totalOrders
  const totalRevenue = kpis.netRevenue
  const refundRate = totalOrders > 0
    ? ((kpis.totalRefunds / totalOrders) * 100).toFixed(1)
    : '0.0'
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

  // Top products (top 10 by order count)
  const productMap = new Map<string, { orders: number; revenue: number }>()
  for (const order of orders) {
    const items: LineItemJson[] = Array.isArray(order.line_items) ? order.line_items : []
    for (const item of items) {
      const title = item.title ?? 'Unknown'
      const existing = productMap.get(title) ?? { orders: 0, revenue: 0 }
      const lineRevenue = (Number(item.price) || 0) * (Number(item.quantity) || 0)
      productMap.set(title, {
        orders:  existing.orders + (Number(item.quantity) || 1),
        revenue: existing.revenue + lineRevenue,
      })
    }
  }
  const topProducts: TopProduct[] = Array.from(productMap.entries())
    .map(([title, v]) => ({ title, orders: v.orders, revenue: v.revenue }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 10)

  // Monthly breakdown (last 12 months)
  const monthMap = new Map<string, { orders: number; revenue: number; refunds: number }>()
  for (const order of orders) {
    if (!order.created_at) continue
    const key = order.created_at.slice(0, 7) // YYYY-MM
    const existing = monthMap.get(key) ?? { orders: 0, revenue: 0, refunds: 0 }
    monthMap.set(key, {
      orders:  existing.orders + 1,
      revenue: existing.revenue + (Number(order.total_price) || 0),
      refunds: existing.refunds + (Number(order.refund_amount) || 0),
    })
  }
  const monthlyBreakdown: MonthlyBreakdown[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([key, v]) => ({
      month:   monthLabel(key),
      orders:  v.orders,
      revenue: v.revenue,
      refunds: v.refunds,
    }))

  return { totalOrders, totalRevenue, refundRate, avgOrderValue, topProducts, monthlyBreakdown }
}

// ─── Analytics report data assembly ──────────────────────────────────────────

async function buildAnalyticsReportData(workspaceId: string, storeId?: string): Promise<AnalyticsReportData> {
  const range30 = dateRange30Days()
  const range12 = dateRange12Months()

  const [kpis, trend, orders] = await Promise.all([
    fetchKPIs(workspaceId, range12, storeId),
    fetchRevenueTrend(workspaceId, range30, storeId),
    fetchOrders(workspaceId, storeId),
  ])

  const refundRate = kpis.totalOrders > 0
    ? ((kpis.totalRefunds / kpis.totalOrders) * 100).toFixed(1)
    : '0.0'

  // Revenue trend: last 30 entries
  const revenueTrend = trend.slice(-30)

  // Top refund reasons (top 10)
  const reasonMap = new Map<string, { count: number; amount: number }>()
  for (const order of orders) {
    const refundAmt = Number(order.refund_amount) || 0
    if (refundAmt <= 0) continue
    const reason = order.refund_reason?.trim() || 'Not specified'
    const existing = reasonMap.get(reason) ?? { count: 0, amount: 0 }
    reasonMap.set(reason, { count: existing.count + 1, amount: existing.amount + refundAmt })
  }
  const topRefundReasons: RefundReason[] = Array.from(reasonMap.entries())
    .map(([reason, v]) => ({ reason, count: v.count, amount: v.amount }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Top refund products (top 10)
  const refundProductMap = new Map<string, { count: number; amount: number }>()
  for (const order of orders) {
    const refundAmt = Number(order.refund_amount) || 0
    if (refundAmt <= 0) continue
    const items: LineItemJson[] = Array.isArray(order.line_items) ? order.line_items : []
    for (const item of items) {
      const title = item.title ?? 'Unknown'
      const existing = refundProductMap.get(title) ?? { count: 0, amount: 0 }
      refundProductMap.set(title, {
        count:  existing.count + 1,
        amount: existing.amount + refundAmt,
      })
    }
  }
  const topRefundProducts: RefundProduct[] = Array.from(refundProductMap.entries())
    .map(([title, v]) => ({ title, count: v.count, amount: v.amount }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    totalOrders:      kpis.totalOrders,
    revenue:          kpis.netRevenue,
    refunds:          kpis.returns,
    refundRate,
    revenueTrend,
    topRefundReasons,
    topRefundProducts,
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Render an Orders & Refunds PDF report to a Buffer.
 * Includes 4 KPI boxes, top 10 products table, and last-12-month breakdown.
 */
export async function renderOrdersReportPDF(
  workspaceId: string,
  storeId?: string,
): Promise<Buffer> {
  const data = await buildOrdersReportData(workspaceId, storeId)
  const generatedAt = formatDate(new Date().toISOString())
  return Buffer.from(
    await renderToBuffer(<OrdersReportDocument data={data} generatedAt={generatedAt} />)
  )
}

/**
 * Render an Analytics PDF report to a Buffer.
 * Includes 4 KPI boxes, revenue trend table, top refund reasons, top refund products.
 */
export async function renderAnalyticsReportPDF(
  workspaceId: string,
  storeId?: string,
): Promise<Buffer> {
  const data = await buildAnalyticsReportData(workspaceId, storeId)
  const generatedAt = formatDate(new Date().toISOString())
  return Buffer.from(
    await renderToBuffer(<AnalyticsReportDocument data={data} generatedAt={generatedAt} />)
  )
}
