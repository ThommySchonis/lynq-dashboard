'use client'
import { useInvoices } from '@/hooks/billing/use-billing-data'
import { InvoiceRow } from './invoice-row'

export function PaymentHistoryTab() {
  const q = useInvoices()
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (q.isError) return <p className="text-sm text-destructive">Failed to load invoices.</p>
  const invoices = q.data ?? []
  if (invoices.length === 0) {
    return <p className="text-sm text-muted-foreground">No charges yet.</p>
  }
  return (
    <ul className="rounded-lg border border-border bg-card px-4">
      {invoices.map((inv) => <InvoiceRow key={inv.id} invoice={inv} />)}
    </ul>
  )
}
