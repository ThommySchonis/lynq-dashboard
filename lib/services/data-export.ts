// lib/services/data-export.ts
//
// CSV export service. Provides serialization helpers and three domain-specific
// export functions that query Supabase and return CSV strings ready to be
// streamed to the client.
//
// All queries use supabaseAdmin (RLS bypass). Callers must have already
// verified the user can act on the workspace via getAuthContext.

import { supabaseAdmin } from '../supabaseAdmin'
import { resolveAnalyticsInputs, resolveOrders } from '@/lib/services/data-export-sources'
import type { ShopifyCredentials } from '@/lib/services/shopify-types'

// ── Types ────────────────────────────────────────────────────────────────────

interface ExportParams {
  workspaceId: string
  storeId: string
  credentials: ShopifyCredentials
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
 * Export orders for the selected store, flattened to one row per line item.
 * Sources live Shopify order data (or demo data) via resolveOrders.
 */
export async function exportOrdersCSV(params: ExportParams): Promise<string> {
  const now = new Date()
  const to = now.toISOString().slice(0, 10)
  const from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const orders = await resolveOrders({ credentials: params.credentials, range: { from, to } })

  const headers = [
    'Order Number', 'Date', 'Customer Name', 'Customer Email', 'Financial Status',
    'Fulfillment Status', 'Order Total', 'Refund Reason', 'Refund Amount', 'Refunded At',
    'Item Title', 'Item Variant', 'Item SKU', 'Item Quantity', 'Item Price',
  ]

  const rows: string[][] = []
  for (const order of orders) {
    const base = [
      order.orderNumber ?? '',
      order.createdAt ?? '',
      order.customer ?? '',
      order.customerEmail ?? '',
      order.financialStatus ?? '',
      order.fulfillmentStatus ?? '',
      order.totalPrice != null ? String(order.totalPrice) : '',
      order.refundReason ?? '',
      order.refundAmount != null ? String(order.refundAmount) : '',
      order.refundedAt ?? '',
    ]

    if (order.lineItems.length === 0) {
      rows.push([...base, '', '', '', '', ''])
    } else {
      for (const item of order.lineItems) {
        rows.push([
          ...base,
          item.title ?? '',
          item.variantTitle ?? '',
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
 * Export analytics for the selected store in three labelled sections:
 * KPI Summary, Revenue Trend (last 90 days), Refunds. Sourced via
 * resolveAnalyticsInputs (RPCs + live refunds, or demo data).
 */
export async function exportAnalyticsCSV(params: ExportParams): Promise<string> {
  const now = new Date()
  const to = now.toISOString().slice(0, 10)
  const from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { kpi, trend, refunds } = await resolveAnalyticsInputs({
    workspaceId: params.workspaceId,
    storeId: params.storeId,
    credentials: params.credentials,
    range: { from, to },
  })

  const sections: string[] = []

  // Section 1: KPI Summary
  const kpiData: string[][] = [
    ['Total Orders', String(kpi.totalOrders ?? 0)],
    ['Total Refunds', String(kpi.totalRefunds ?? 0)],
    ['Net Revenue', String(Math.round(Number(kpi.netRevenue ?? 0)))],
    ['Returns', String(Math.round(Number(kpi.returns ?? 0)))],
    ['Cancelled Orders', String(kpi.cancelledOrders ?? 0)],
    ['Discounts', String(Math.round(Number(kpi.discounts ?? 0)))],
  ]
  sections.push('--- KPI Summary ---')
  sections.push(formatCSV(['Metric', 'Value'], kpiData))

  // Section 2: Revenue Trend
  const trendCsvRows: string[][] = trend.map((row) => [
    row.date,
    String(Math.max(0, Number(row.revenue) || 0)),
  ])
  sections.push('')
  sections.push('--- Revenue Trend (Last 90 Days) ---')
  sections.push(formatCSV(['Date', 'Revenue'], trendCsvRows))

  // Section 3: Refunds
  const refundCsvRows: string[][] = refunds.map((row) => [
    row.orderId ?? '',
    row.customer ?? '',
    row.reason ?? '',
    row.refundAmount != null ? String(row.refundAmount) : '',
    row.refundedAt ?? '',
    (row.products ?? []).join('; '),
  ])
  sections.push('')
  sections.push('--- Refunds ---')
  sections.push(formatCSV(['Order', 'Customer', 'Reason', 'Amount', 'Date', 'Products'], refundCsvRows))

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
