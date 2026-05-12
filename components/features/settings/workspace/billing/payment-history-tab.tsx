'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { InvoiceRow } from './invoice-row'
import { useInvoices } from '@/hooks/billing'
import { useAuthStore } from '@/stores/auth'

const PER_PAGE = 25

/**
 * Tab 3 — Payment History. Paginated invoice table. Account owner
 * receives an emailed invoice at the start of each billing period.
 */
export function PaymentHistoryTab() {
  const [page, setPage] = useState(0)
  const { data, isLoading } = useInvoices(page, PER_PAGE)
  const token = useAuthStore(s => s.session?.access_token ?? '')

  const invoices = data?.invoices ?? []
  const total    = data?.total ?? 0
  const hasMore  = total > (page + 1) * PER_PAGE

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">Payment history</h3>
        <p className="text-xs text-muted-foreground">
          The account owner receives an invoice by email at the start of each billing period.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <FileText size={24} className="text-muted-foreground" />
            <p className="text-sm font-medium">No invoices yet</p>
            <p className="text-xs text-muted-foreground">
              Your first invoice will appear here at the end of your trial.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/40">
                <tr className="border-b border-border">
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Date</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Amount</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Due</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Paid</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Description</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {invoices.map(invoice => (
                  <InvoiceRow key={invoice.id} invoice={invoice} token={token} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(page > 0 || hasMore) && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {total > 0 && `Showing ${page * PER_PAGE + 1}–${Math.min((page + 1) * PER_PAGE, total)} of ${total}`}
          </span>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
              Previous
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={!hasMore} onClick={() => setPage(p => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
