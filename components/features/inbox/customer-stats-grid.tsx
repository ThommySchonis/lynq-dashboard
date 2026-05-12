'use client'

import { fmtPrice } from '@/lib/inbox-utils'

// ── Props ────────────────────────────────────────────────────────────────────

interface CustomerStatsGridProps {
  ordersCount?: number
  totalSpent?: string
  currency?: string
  createdAt?: string
}

// ── Component ────────────────────────────────────────────────────────────────

export function CustomerStatsGrid({
  ordersCount,
  totalSpent,
  currency,
  createdAt,
}: CustomerStatsGridProps) {
  return (
    <div className="grid grid-cols-3 divide-x divide-border bg-muted/20 px-0 py-0 shrink-0">
      <div className="flex flex-col items-center py-3 gap-0.5">
        <span className="text-sm font-extrabold text-foreground leading-none">
          {ordersCount ?? '—'}
        </span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
          Orders
        </span>
      </div>
      <div className="flex flex-col items-center py-3 gap-0.5">
        <span className="text-sm font-extrabold text-foreground leading-none">
          {totalSpent != null
            ? fmtPrice(totalSpent, currency)
            : '—'}
        </span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
          Spent
        </span>
      </div>
      <div className="flex flex-col items-center py-3 gap-0.5">
        <span className="text-sm font-extrabold text-foreground leading-none">
          {createdAt
            ? new Date(createdAt).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
              })
            : '—'}
        </span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
          Since
        </span>
      </div>
    </div>
  )
}
