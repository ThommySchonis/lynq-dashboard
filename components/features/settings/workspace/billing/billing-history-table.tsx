'use client'

import { FileText } from 'lucide-react'
import { useInvoices } from '@/hooks/billing/use-billing-data'
import { formatBillingDate, formatMoney } from '@/lib/billing-format'
import type { Invoice } from '@/types/billing'
import { StatusPill, type StatusTone } from './status-pill'

function invoiceStatus(status: string): { label: string; tone: StatusTone } {
  const key = status.toLowerCase()
  const label = key.charAt(0).toUpperCase() + key.slice(1)
  if (key === 'paid') return { label, tone: 'success' }
  if (['failed', 'unpaid', 'voided', 'declined'].includes(key)) return { label, tone: 'destructive' }
  return { label, tone: 'neutral' }
}

const COL_DATE = 'w-[130px] shrink-0'
const COL_AMOUNT = 'flex w-[110px] shrink-0 justify-end'
const COL_STATUS = 'w-[110px] shrink-0'
const COL_INVOICE = 'flex w-[90px] shrink-0 justify-end'
const HEAD = 'text-xs font-semibold uppercase tracking-[0.08em] text-foreground-4'

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const status = invoiceStatus(invoice.status)
  return (
    <div className="flex items-center gap-4 border-t border-settings-divider px-[22px] py-[15px]">
      <span className={`${COL_DATE} text-sm font-medium text-foreground-2`}>
        {formatBillingDate(invoice.date, 'short')}
      </span>
      <span className="flex-1 truncate text-sm font-semibold text-foreground">{invoice.planName}</span>
      <span className={`${COL_AMOUNT} text-sm font-semibold text-foreground`}>
        {formatMoney(invoice.amount, invoice.currency)}
      </span>
      <span className={COL_STATUS}>
        <StatusPill label={status.label} tone={status.tone} />
      </span>
      <span className={COL_INVOICE}>
        {invoice.receiptUrl ? (
          <a
            href={invoice.receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-primary transition-colors hover:text-primary-hover"
          >
            <FileText size={14} strokeWidth={1.75} />
            PDF
          </a>
        ) : (
          <span className="text-xs text-foreground-4">—</span>
        )}
      </span>
    </div>
  )
}

export function BillingHistoryTable() {
  const q = useInvoices()
  const invoices = q.data ?? []

  return (
    <>
      <h2 className="text-lg font-bold text-foreground">Billing history</h2>

      <div className="overflow-hidden rounded-2xl border border-settings-border bg-card">
        <div className="flex items-center gap-4 bg-foreground/[0.02] px-[22px] py-[13px]">
          <span className={`${COL_DATE} ${HEAD}`}>Date</span>
          <span className={`flex-1 ${HEAD}`}>Description</span>
          <span className={`${COL_AMOUNT} ${HEAD}`}>Amount</span>
          <span className={`${COL_STATUS} ${HEAD}`}>Status</span>
          <span className={`${COL_INVOICE} ${HEAD}`}>Invoice</span>
        </div>

        {q.isLoading ? (
          <p className="border-t border-settings-divider px-[22px] py-6 text-sm text-muted-foreground">Loading…</p>
        ) : q.isError ? (
          <p className="border-t border-settings-divider px-[22px] py-6 text-sm text-destructive">
            Failed to load invoices.
          </p>
        ) : invoices.length === 0 ? (
          <p className="border-t border-settings-divider px-[22px] py-6 text-sm text-muted-foreground">
            No invoices yet.
          </p>
        ) : (
          invoices.map((inv) => <InvoiceRow key={inv.id} invoice={inv} />)
        )}
      </div>
    </>
  )
}
