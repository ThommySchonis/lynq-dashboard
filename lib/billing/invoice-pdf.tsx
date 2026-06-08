// lib/billing/invoice-pdf.tsx
//
// Invoice PDF rendering via @react-pdf/renderer.
//
// Three variants by customer country (per Lynq & Flow LLC tax posture):
//   - US customer → no VAT line, no reverse-charge note
//   - EU customer → no VAT line + Article 196 reverse-charge footer
//   - Rest-of-world → no VAT line, no special note
//
// All variants share the same header (issuer block) and line-items
// table. Renders to a Buffer that the route hands to NextResponse.

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'
import React from 'react'
import { ISSUER, isEUCountry } from './issuer'

// Legacy invoice shape used by PDF renderer (Whop-era billing records).
// Kept here to avoid coupling with @/types/billing which now uses the
// Shopify-native Invoice shape for the frontend.
interface Invoice {
  id: string
  workspace_id: string
  invoice_number: string
  status: string
  period_start: string
  period_end: string
  subtotal_eur: number
  vat_amount_eur: number
  total_eur: number
  amount_paid_eur: number
  amount_due_eur: number
  description: string | null
  line_items: Array<{
    description: string
    quantity: number
    unit_price: number
    total: number
  }>
  paid_at: string | null
  pdf_url: string | null
  billing_email: string | null
  billing_org_name: string | null
  billing_address: {
    line1: string | null
    line2: string | null
    city: string | null
    postal_code: string | null
    country: string | null
    state: string | null
  } | null
  vat_number: string | null
  created_at: string
}

// ─── Font registration (system default — keep it simple) ────────────
// react-pdf ships Helvetica/Times/Courier as built-ins. We use the
// default Helvetica family — no external font fetch at runtime.
// If brand typography is needed later, register a hosted .ttf here.

const COLORS = {
  ink:         '#1C0F36',
  mutedInk:    '#6B5E7B',
  lightInk:    '#9B91A8',
  border:      '#E5E0EB',
  accent:      '#A175FC',
  surface:     '#F8F7FA',
}

const styles = StyleSheet.create({
  page: {
    padding:    40,
    fontSize:   10,
    color:      COLORS.ink,
    fontFamily: 'Helvetica',
  },
  // ── Header ─────────────────────────────────────────────────────
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginBottom:   32,
  },
  brand: {
    fontSize:    18,
    fontWeight:  700,
    color:       COLORS.ink,
    marginBottom: 4,
  },
  brandSubtitle: {
    fontSize: 9,
    color:    COLORS.mutedInk,
  },
  invoiceMeta: {
    textAlign: 'right',
  },
  invoiceLabel: {
    fontSize:      9,
    color:         COLORS.lightInk,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom:  4,
  },
  invoiceNumber: {
    fontSize:    16,
    fontWeight:  700,
    color:       COLORS.ink,
    marginBottom: 4,
  },
  invoiceDate: {
    fontSize: 9,
    color:    COLORS.mutedInk,
  },
  // ── From / To blocks ───────────────────────────────────────────
  addressRow: {
    flexDirection: 'row',
    marginBottom:  28,
    gap:           28,
  },
  addressBlock: {
    flex:         1,
    paddingRight: 16,
  },
  addressLabel: {
    fontSize:      8,
    color:         COLORS.lightInk,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom:  6,
  },
  addressName: {
    fontSize:    11,
    fontWeight:  700,
    marginBottom: 3,
  },
  addressLine: {
    fontSize:    9,
    color:       COLORS.mutedInk,
    marginBottom: 2,
  },
  // ── Status badge ───────────────────────────────────────────────
  statusRow: {
    flexDirection: 'row',
    marginBottom:  20,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      4,
    fontSize:          8,
    fontWeight:        700,
    textTransform:     'uppercase',
    letterSpacing:     0.5,
  },
  statusPaid:   { backgroundColor: '#DCFCE7', color: '#166534' },
  statusOpen:   { backgroundColor: '#FEF3C7', color: '#92400E' },
  statusFailed: { backgroundColor: '#FEE2E2', color: '#991B1B' },
  statusVoid:   { backgroundColor: COLORS.surface, color: COLORS.lightInk },
  statusDraft:  { backgroundColor: COLORS.surface, color: COLORS.mutedInk },
  // ── Line items table ───────────────────────────────────────────
  table: {
    marginBottom: 24,
  },
  tableHeader: {
    flexDirection:    'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom:    6,
    marginBottom:     6,
  },
  tableHeaderCell: {
    fontSize:      8,
    fontWeight:    700,
    color:         COLORS.lightInk,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tableRow: {
    flexDirection:    'row',
    paddingVertical:  6,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  colDescription: { flex: 4 },
  colQty:         { flex: 1, textAlign: 'right' },
  colUnit:        { flex: 1.5, textAlign: 'right' },
  colTotal:       { flex: 1.5, textAlign: 'right' },
  cell: {
    fontSize: 10,
    color:    COLORS.ink,
  },
  cellMuted: {
    fontSize: 10,
    color:    COLORS.mutedInk,
  },
  // ── Totals ─────────────────────────────────────────────────────
  totals: {
    alignSelf:    'flex-end',
    width:        220,
    marginTop:    8,
    marginBottom: 24,
  },
  totalRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalLabel: {
    fontSize: 10,
    color:    COLORS.mutedInk,
  },
  totalValue: {
    fontSize: 10,
    color:    COLORS.ink,
  },
  totalGrand: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    paddingTop:     8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop:      4,
  },
  totalGrandLabel: {
    fontSize:   11,
    fontWeight: 700,
    color:      COLORS.ink,
  },
  totalGrandValue: {
    fontSize:   13,
    fontWeight: 700,
    color:      COLORS.ink,
  },
  // ── Footer ─────────────────────────────────────────────────────
  footer: {
    position:    'absolute',
    bottom:      32,
    left:        40,
    right:       40,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop:  10,
  },
  footerText: {
    fontSize:   8,
    color:      COLORS.lightInk,
    lineHeight: 1.5,
  },
  reverseCharge: {
    fontSize:    8,
    color:       COLORS.mutedInk,
    marginBottom: 4,
    fontStyle:    'italic',
  },
})

function formatEUR(amount: number): string {
  return `€${amount.toFixed(2)}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
}

function statusStyle(status: Invoice['status']) {
  switch (status) {
    case 'paid':   return styles.statusPaid
    case 'open':   return styles.statusOpen
    case 'failed': return styles.statusFailed
    case 'void':   return styles.statusVoid
    default:       return styles.statusDraft
  }
}

interface InvoiceDocumentProps {
  invoice: Invoice
}

const InvoiceDocument: React.FC<InvoiceDocumentProps> = ({ invoice }) => {
  const customerCountry = invoice.billing_address?.country || ''
  const showReverseChargeNote = isEUCountry(customerCountry)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Lynq &amp; Flow</Text>
            <Text style={styles.brandSubtitle}>Customer support helpdesk</Text>
          </View>
          <View style={styles.invoiceMeta}>
            <Text style={styles.invoiceLabel}>Invoice</Text>
            <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
            <Text style={styles.invoiceDate}>Issued {formatDate(invoice.created_at)}</Text>
          </View>
        </View>

        {/* Status badge */}
        <View style={styles.statusRow}>
          <Text style={[styles.statusBadge, statusStyle(invoice.status)]}>
            {invoice.status.toUpperCase()}
          </Text>
        </View>

        {/* From / Bill To */}
        <View style={styles.addressRow}>
          <View style={styles.addressBlock}>
            <Text style={styles.addressLabel}>From</Text>
            <Text style={styles.addressName}>{ISSUER.legalName}</Text>
            <Text style={styles.addressLine}>{ISSUER.address.line1}</Text>
            <Text style={styles.addressLine}>{ISSUER.address.line2}</Text>
            <Text style={styles.addressLine}>
              {ISSUER.address.city}, {ISSUER.address.state} {ISSUER.address.postalCode}
            </Text>
            <Text style={styles.addressLine}>{ISSUER.address.country}</Text>
            <Text style={styles.addressLine}>EIN: {ISSUER.ein}</Text>
            <Text style={styles.addressLine}>{ISSUER.contactEmail}</Text>
          </View>

          <View style={styles.addressBlock}>
            <Text style={styles.addressLabel}>Bill to</Text>
            {invoice.billing_org_name && (
              <Text style={styles.addressName}>{invoice.billing_org_name}</Text>
            )}
            {invoice.billing_address?.line1 && (
              <Text style={styles.addressLine}>{invoice.billing_address.line1}</Text>
            )}
            {invoice.billing_address?.line2 && (
              <Text style={styles.addressLine}>{invoice.billing_address.line2}</Text>
            )}
            {(invoice.billing_address?.city || invoice.billing_address?.postal_code) && (
              <Text style={styles.addressLine}>
                {invoice.billing_address?.city}
                {invoice.billing_address?.city && invoice.billing_address?.postal_code ? ', ' : ''}
                {invoice.billing_address?.postal_code}
              </Text>
            )}
            {invoice.billing_address?.state && (
              <Text style={styles.addressLine}>{invoice.billing_address.state}</Text>
            )}
            {invoice.billing_address?.country && (
              <Text style={styles.addressLine}>{invoice.billing_address.country}</Text>
            )}
            {invoice.vat_number && (
              <Text style={styles.addressLine}>VAT: {invoice.vat_number}</Text>
            )}
            {invoice.billing_email && (
              <Text style={styles.addressLine}>{invoice.billing_email}</Text>
            )}
          </View>
        </View>

        {/* Line items */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colDescription]}>Description</Text>
            <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, styles.colUnit]}>Unit</Text>
            <Text style={[styles.tableHeaderCell, styles.colTotal]}>Total</Text>
          </View>

          {invoice.line_items.map((item, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={[styles.cell, styles.colDescription]}>{item.description}</Text>
              <Text style={[styles.cellMuted, styles.colQty]}>{item.quantity}</Text>
              <Text style={[styles.cellMuted, styles.colUnit]}>{formatEUR(item.unit_price)}</Text>
              <Text style={[styles.cell, styles.colTotal]}>{formatEUR(item.total)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatEUR(invoice.subtotal_eur)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>VAT</Text>
            <Text style={styles.totalValue}>{formatEUR(invoice.vat_amount_eur)}</Text>
          </View>
          {invoice.amount_paid_eur > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Paid</Text>
              <Text style={styles.totalValue}>−{formatEUR(invoice.amount_paid_eur)}</Text>
            </View>
          )}
          <View style={styles.totalGrand}>
            <Text style={styles.totalGrandLabel}>
              {invoice.status === 'paid' ? 'Total paid' : 'Amount due'}
            </Text>
            <Text style={styles.totalGrandValue}>{formatEUR(invoice.amount_due_eur)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          {showReverseChargeNote && (
            <Text style={styles.reverseCharge}>{ISSUER.invoiceFooter}</Text>
          )}
          <Text style={styles.footerText}>
            Payment processed by {ISSUER.paymentProcessor} · Statement descriptor: WHOP * LYNQ FLOW
          </Text>
          <Text style={styles.footerText}>
            Lynq &amp; Flow LLC · Wyoming Entity ID {ISSUER.wyomingEntityId} · {ISSUER.website}
          </Text>
        </View>
      </Page>
    </Document>
  )
}

/**
 * Render an invoice to a PDF Buffer. API route streams this back as
 * `application/pdf` with the invoice_number as filename.
 */
export async function renderInvoicePDF(invoice: Invoice): Promise<Buffer> {
  return await renderToBuffer(<InvoiceDocument invoice={invoice} />)
}
