'use client'

import { fmtPrice } from '@/lib/inbox-utils'

interface CustomerStatsProps {
  totalSpent: string | number
  currency: string
  ordersCount: number
  refundPct: number
  approx: boolean
}

export function CustomerStats({ totalSpent, currency, ordersCount, refundPct, approx }: CustomerStatsProps) {
  const badgeColor = refundPct > 30 ? '#f87171' : refundPct > 10 ? '#fbbf24' : null

  return (
    <div className="flex border-b border-border shrink-0">
      <div className="flex-1 py-2.5 text-center border-r border-border">
        <div className="text-sm font-extrabold text-foreground tracking-[-0.02em]">
          {fmtPrice(totalSpent, currency)}
        </div>
        <div className="text-[9.5px] text-muted-foreground mt-0.5 uppercase tracking-[.06em]">Spent</div>
      </div>
      <div className="flex-1 py-2.5 text-center border-r border-border">
        <div className="text-sm font-extrabold text-foreground tracking-[-0.02em]">{ordersCount ?? '—'}</div>
        <div className="text-[9.5px] text-muted-foreground mt-0.5 uppercase tracking-[.06em]">Orders</div>
      </div>
      <div className="flex-1 py-2.5 text-center">
        <div className="text-sm font-extrabold tracking-[-0.02em]" style={{ color: badgeColor || 'var(--foreground)' }}>
          {approx ? '~' : ''}
          {refundPct}%
        </div>
        <div className="text-[9.5px] text-muted-foreground mt-0.5 uppercase tracking-[.06em]">Refund</div>
      </div>
    </div>
  )
}
