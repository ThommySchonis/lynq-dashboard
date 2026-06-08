'use client'
import type { Invoice } from '@/types/billing'

export function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const date = new Date(invoice.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  const amount = invoice.amount.toLocaleString(undefined, { style: 'currency', currency: invoice.currency || 'EUR' })
  return (
    <li className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-border py-3 text-sm last:border-0">
      <span>{invoice.planName}</span>
      <span className="text-muted-foreground">{date}</span>
      <span className="font-medium">{amount}</span>
      <span className="text-xs text-muted-foreground capitalize">{invoice.status.toLowerCase()}</span>
    </li>
  )
}
