// lib/services/data-export.ts
//
// CSV export service. Provides serialization helpers and three domain-specific
// export functions that query Supabase and return CSV strings ready to be
// streamed to the client.
//
// All queries use supabaseAdmin (RLS bypass). Callers must have already
// verified the user can act on the workspace via getAuthContext.

import { supabaseAdmin } from '../supabaseAdmin'

// ── Types ────────────────────────────────────────────────────────────────────

interface LineItem {
  title?: string
  quantity?: number
  price?: string | number
  sku?: string
  variant_title?: string
}

interface ShopifyOrderRow {
  order_number: string | null
  created_at: string | null
  customer_name: string | null
  customer_email: string | null
  financial_status: string | null
  fulfillment_status: string | null
  total_price: number | string | null
  refund_status: string | null
  refund_reason: string | null
  refund_amount: number | string | null
  refunded_at: string | null
  line_items: LineItem[] | null
  store_id: string | null
}

interface KPIData {
  totalOrders?: number
  totalRefunds?: number
  netRevenue?: number
  returns?: number
  cancelledOrders?: number
  discounts?: number
  refundRate?: string | number
}

interface RevenueTrendRow {
  date: string
  revenue: number | string
}

interface InvoiceRow {
  invoice_number: string | null
  created_at: string | null
  period_start: string | null
  period_end: string | null
  status: string | null
  subtotal_eur: number | string | null
  vat_amount_eur: number | string | null
  total_eur: number | string | null
  amount_paid_eur: number | string | null
  amount_due_eur: number | string | null
  description: string | null
}

// ── CSV serializer ───────────────────────────────────────────────────────────

/**
 * Serialize headers + rows to a RFC-4180-compliant CSV string.
 *
 * Escaping rules:
 *  - Fields containing commas, double-quotes, or newlines are wrapped in
 *    double-quotes.
 *  - Any literal double-quote character inside a field is doubled ("").
 */
export function formatCSV(headers: string[], rows: string[][]): string {
  const escapeField = (field: string): string => {
    const needsQuoting = field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')
    if (!needsQuoting) return field
    return `"${field.replace(/"/g, '""')}"`
  }

  const serializeRow = (cols: string[]): string =>
    cols.map(escapeField).join(',')

  const lines: string[] = [serializeRow(headers)]
  for (const row of rows) {
    lines.push(serializeRow(row))
  }
  return lines.join('\r\n')
}

// ── Orders CSV ───────────────────────────────────────────────────────────────

/**
 * Export shopify_orders for a workspace, flattened to one row per line item.
 * Excludes demo data. Optionally filtered by storeId.
 */
export async function exportOrdersCSV(workspaceId: string, storeId?: string): Promise<string> {
  let query = supabaseAdmin
    .from('shopify_orders')
    .select(
      'order_number, created_at, customer_name, customer_email, financial_status, fulfillment_status, total_price, refund_status, refund_reason, refund_amount, refunded_at, line_items, store_id'
    )
    .eq('workspace_id', workspaceId)
    .eq('is_demo', false)
    .order('created_at', { ascending: false })

  if (storeId) {
    query = query.eq('store_id', storeId)
  }

  const { data, error } = await query

  if (error) throw new Error(`exportOrdersCSV query failed: ${error.message}`)

  const orders = (data as ShopifyOrderRow[]) || []

  const headers = [
    'Order Number',
    'Date',
    'Customer Name',
    'Customer Email',
    'Financial Status',
    'Fulfillment Status',
    'Order Total',
    'Refund Status',
    'Refund Reason',
    'Refund Amount',
    'Refunded At',
    'Store ID',
    'Item Title',
    'Item Variant',
    'Item SKU',
    'Item Quantity',
    'Item Price',
  ]

  const rows: string[][] = []

  for (const order of orders) {
    const lineItems: LineItem[] = Array.isArray(order.line_items) ? order.line_items : []

    if (lineItems.length === 0) {
      // Order with no line items — emit one row with blank item columns
      rows.push([
        order.order_number ?? '',
        order.created_at ?? '',
        order.customer_name ?? '',
        order.customer_email ?? '',
        order.financial_status ?? '',
        order.fulfillment_status ?? '',
        order.total_price != null ? String(order.total_price) : '',
        order.refund_status ?? '',
        order.refund_reason ?? '',
        order.refund_amount != null ? String(order.refund_amount) : '',
        order.refunded_at ?? '',
        order.store_id ?? '',
        '',
        '',
        '',
        '',
        '',
      ])
    } else {
      for (const item of lineItems) {
        rows.push([
          order.order_number ?? '',
          order.created_at ?? '',
          order.customer_name ?? '',
          order.customer_email ?? '',
          order.financial_status ?? '',
          order.fulfillment_status ?? '',
          order.total_price != null ? String(order.total_price) : '',
          order.refund_status ?? '',
          order.refund_reason ?? '',
          order.refund_amount != null ? String(order.refund_amount) : '',
          order.refunded_at ?? '',
          order.store_id ?? '',
          item.title ?? '',
          item.variant_title ?? '',
          item.sku ?? '',
          item.quantity != null ? String(item.quantity) : '',
          item.price != null ? String(item.price) : '',
        ])
      }
    }
  }

  return formatCSV(headers, rows)
}

// ── Analytics CSV ────────────────────────────────────────────────────────────

/**
 * Export analytics data for a workspace in three labelled sections:
 *  1. KPI Summary
 *  2. Revenue Trend (last 90 days)
 *  3. Refunds
 *
 * Sections are separated by a blank line followed by a section header row.
 */
export async function exportAnalyticsCSV(workspaceId: string, storeId?: string): Promise<string> {
  const now = new Date()
  const toDate = now.toISOString().slice(0, 10)
  const fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const storeIdParam = storeId ?? null

  // Fetch KPIs, revenue trend, and refund orders in parallel
  const [kpiResult, trendResult, refundResult] = await Promise.all([
    supabaseAdmin.rpc('get_kpis', {
      p_workspace_id: workspaceId,
      p_from: fromDate,
      p_to: toDate,
      p_store_id: storeIdParam,
    }),
    supabaseAdmin.rpc('get_revenue_trend', {
      p_workspace_id: workspaceId,
      p_from: fromDate,
      p_to: toDate,
      p_store_id: storeIdParam,
    }),
    supabaseAdmin
      .from('shopify_orders')
      .select('order_number, customer_name, refund_reason, refund_amount, refunded_at')
      .eq('workspace_id', workspaceId)
      .eq('is_demo', false)
      .not('refund_amount', 'is', null)
      .gt('refund_amount', 0)
      .order('refunded_at', { ascending: false }),
  ])

  if (kpiResult.error) throw new Error(`get_kpis RPC failed: ${kpiResult.error.message}`)
  if (trendResult.error) throw new Error(`get_revenue_trend RPC failed: ${trendResult.error.message}`)
  if (refundResult.error) throw new Error(`exportAnalyticsCSV refund query failed: ${refundResult.error.message}`)

  const kpi = (kpiResult.data as KPIData) ?? {}
  const trendRows = (trendResult.data as RevenueTrendRow[]) ?? []

  interface RefundRow {
    order_number: string | null
    customer_name: string | null
    refund_reason: string | null
    refund_amount: number | string | null
    refunded_at: string | null
  }

  const refundRows = (refundResult.data as RefundRow[]) ?? []

  const sections: string[] = []

  // ── Section 1: KPI Summary ──
  const kpiHeaders = ['Metric', 'Value']
  const kpiData: string[][] = [
    ['Total Orders', String(kpi.totalOrders ?? 0)],
    ['Total Refunds', String(kpi.totalRefunds ?? 0)],
    ['Net Revenue', String(Math.round(Number(kpi.netRevenue ?? 0)))],
    ['Returns', String(Math.round(Number(kpi.returns ?? 0)))],
    ['Cancelled Orders', String(kpi.cancelledOrders ?? 0)],
    ['Discounts', String(Math.round(Number(kpi.discounts ?? 0)))],
  ]
  sections.push('--- KPI Summary ---')
  sections.push(formatCSV(kpiHeaders, kpiData))

  // ── Section 2: Revenue Trend ──
  const trendHeaders = ['Date', 'Revenue']
  const trendCsvRows: string[][] = trendRows.map((row) => [
    row.date,
    String(Math.max(0, Number(row.revenue) || 0)),
  ])
  sections.push('')
  sections.push('--- Revenue Trend (Last 90 Days) ---')
  sections.push(formatCSV(trendHeaders, trendCsvRows))

  // ── Section 3: Refunds ──
  const refundHeaders = ['Order', 'Customer', 'Reason', 'Amount', 'Date']
  const refundCsvRows: string[][] = refundRows.map((row) => [
    row.order_number ?? '',
    row.customer_name ?? '',
    row.refund_reason ?? '',
    row.refund_amount != null ? String(row.refund_amount) : '',
    row.refunded_at ?? '',
  ])
  sections.push('')
  sections.push('--- Refunds ---')
  sections.push(formatCSV(refundHeaders, refundCsvRows))

  return sections.join('\r\n')
}

// ── Billing CSV ──────────────────────────────────────────────────────────────

/**
 * Export all invoices for a workspace as CSV.
 */
export async function exportBillingCSV(workspaceId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select(
      'invoice_number, created_at, period_start, period_end, status, subtotal_eur, vat_amount_eur, total_eur, amount_paid_eur, amount_due_eur, description'
    )
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`exportBillingCSV query failed: ${error.message}`)

  const invoices = (data as InvoiceRow[]) || []

  const headers = [
    'Invoice Number',
    'Date',
    'Period Start',
    'Period End',
    'Status',
    'Subtotal (EUR)',
    'VAT Amount (EUR)',
    'Total (EUR)',
    'Amount Paid (EUR)',
    'Amount Due (EUR)',
    'Description',
  ]

  const rows: string[][] = invoices.map((inv) => [
    inv.invoice_number ?? '',
    inv.created_at ?? '',
    inv.period_start ?? '',
    inv.period_end ?? '',
    inv.status ?? '',
    inv.subtotal_eur != null ? String(inv.subtotal_eur) : '',
    inv.vat_amount_eur != null ? String(inv.vat_amount_eur) : '',
    inv.total_eur != null ? String(inv.total_eur) : '',
    inv.amount_paid_eur != null ? String(inv.amount_paid_eur) : '',
    inv.amount_due_eur != null ? String(inv.amount_due_eur) : '',
    inv.description ?? '',
  ])

  return formatCSV(headers, rows)
}
