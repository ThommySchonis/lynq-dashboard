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
  renderToBuffer,
} from '@react-pdf/renderer'
import React from 'react'
import { styles, formatDate } from '@/lib/services/pdf-report-kit'
import { resolveAnalyticsInputs, resolveOrders } from '@/lib/services/data-export-sources'
import type { ShopifyCredentials } from '@/lib/services/shopify-types'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReportParams {
  workspaceId: string
  storeId: string
  credentials: ShopifyCredentials
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatEUR(amount: number): string {
  return `€${amount.toFixed(2)}`
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

// ─── Date range helpers ──────────────────────────────────────────────────────

function dateRange12Months(): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  from.setMonth(from.getMonth() - 12)
  return {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
  }
}


// ─── Orders report data assembly ─────────────────────────────────────────────

export async function buildOrdersReportData(params: ReportParams): Promise<OrdersReportData> {
  const range = dateRange12Months()
  const { kpi } = await resolveAnalyticsInputs({
    workspaceId: params.workspaceId,
    storeId:     params.storeId,
    credentials: params.credentials,
    range,
  })
  const orders = await resolveOrders({ credentials: params.credentials, range })

  const totalOrders = Number(kpi.totalOrders) || 0
  const totalRevenue = Number(kpi.netRevenue) || 0
  const refundRate = totalOrders > 0
    ? ((Number(kpi.totalRefunds) / totalOrders) * 100).toFixed(1)
    : '0.0'
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

  // Top products (top 10 by order count)
  const productMap = new Map<string, { orders: number; revenue: number }>()
  for (const order of orders) {
    for (const item of order.lineItems) {
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
    if (!order.createdAt) continue
    const key = order.createdAt.slice(0, 7) // YYYY-MM
    const existing = monthMap.get(key) ?? { orders: 0, revenue: 0, refunds: 0 }
    monthMap.set(key, {
      orders:  existing.orders + 1,
      revenue: existing.revenue + (Number(order.totalPrice) || 0),
      refunds: existing.refunds + (Number(order.refundAmount) || 0),
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

export async function buildAnalyticsReportData(params: ReportParams): Promise<AnalyticsReportData> {
  const range12 = dateRange12Months()

  // KPIs, trend, and refund tables all span the same 12-month window so the
  // report's headline numbers reconcile with its tables. The trend is sliced
  // to its most recent 30 points below for the chart.
  const { kpi, trend } = await resolveAnalyticsInputs({
    workspaceId: params.workspaceId,
    storeId:     params.storeId,
    credentials: params.credentials,
    range:       range12,
  })
  const orders = await resolveOrders({ credentials: params.credentials, range: range12 })

  const totalOrders = Number(kpi.totalOrders) || 0
  const refundRate = totalOrders > 0
    ? ((Number(kpi.totalRefunds) / totalOrders) * 100).toFixed(1)
    : '0.0'

  // Revenue trend: last 30 entries
  const revenueTrend = trend
    .map((row) => ({ date: row.date, revenue: Math.max(0, Number(row.revenue) || 0) }))
    .slice(-30)

  // Top refund reasons (top 10)
  const reasonMap = new Map<string, { count: number; amount: number }>()
  for (const order of orders) {
    const refundAmt = Number(order.refundAmount) || 0
    if (refundAmt <= 0) continue
    const reason = order.refundReason?.trim() || 'Not specified'
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
    const refundAmt = Number(order.refundAmount) || 0
    if (refundAmt <= 0) continue
    for (const item of order.lineItems) {
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
    totalOrders,
    revenue:  Number(kpi.netRevenue) || 0,
    refunds:  Number(kpi.returns) || 0,
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
export async function renderOrdersReportPDF(params: ReportParams): Promise<Buffer> {
  const data = await buildOrdersReportData(params)
  const generatedAt = formatDate(new Date().toISOString())
  return Buffer.from(
    await renderToBuffer(<OrdersReportDocument data={data} generatedAt={generatedAt} />)
  )
}

/**
 * Render an Analytics PDF report to a Buffer.
 * Includes 4 KPI boxes, revenue trend table, top refund reasons, top refund products.
 */
export async function renderAnalyticsReportPDF(params: ReportParams): Promise<Buffer> {
  const data = await buildAnalyticsReportData(params)
  const generatedAt = formatDate(new Date().toISOString())
  return Buffer.from(
    await renderToBuffer(<AnalyticsReportDocument data={data} generatedAt={generatedAt} />)
  )
}
