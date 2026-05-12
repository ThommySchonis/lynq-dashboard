'use client'

import { Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Invoice } from '@/types/billing'

interface InvoiceRowProps {
  invoice: Invoice
  token:   string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatEUR(amount: number): string {
  return `€${Number(amount).toFixed(2)}`
}

function statusVariant(status: Invoice['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'paid':   return 'default'
    case 'open':   return 'secondary'
    case 'failed': return 'destructive'
    default:       return 'outline'
  }
}

/**
 * Single row in the Payment History table. PDF download is wired
 * to /api/billing/invoices/[id]/pdf via fetch + Blob → object URL
 * so the browser downloads with the right filename.
 */
export function InvoiceRow({ invoice, token }: InvoiceRowProps) {
  async function downloadPDF() {
    const res = await fetch(`/api/billing/invoices/${invoice.id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${invoice.invoice_number}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-3 py-3 text-sm tabular-nums">{formatDate(invoice.created_at)}</td>
      <td className="px-3 py-3 text-sm tabular-nums">{formatEUR(invoice.total_eur)}</td>
      <td className="px-3 py-3 text-sm tabular-nums">{formatEUR(invoice.amount_due_eur)}</td>
      <td className="px-3 py-3 text-sm tabular-nums">{formatEUR(invoice.amount_paid_eur)}</td>
      <td className="px-3 py-3 text-sm text-muted-foreground max-w-md truncate">
        {invoice.description || '—'}
      </td>
      <td className="px-3 py-3">
        <Badge variant={statusVariant(invoice.status)}>{invoice.status}</Badge>
      </td>
      <td className="px-3 py-3 text-right">
        <Button type="button" size="sm" variant="ghost" onClick={downloadPDF}>
          <Download size={14} />
          PDF
        </Button>
      </td>
    </tr>
  )
}
