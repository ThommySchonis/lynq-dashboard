'use client'

import { HelpCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { categorizeReason, CAT_COLORS, fmtEur } from '@/lib/analytics-constants'
import { CardEmptyState } from './card-empty-state'
import type { Refund } from '@/types/analytics'

interface RefundReasonsProps {
  refunds: Refund[]
  loaded: boolean
}

// Card chrome (Figma 916-24438): white, 1px border, radius 16, soft elevation.
const CARD = 'flex-1 rounded-[16px] border border-border bg-card p-[22px_24px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.04),0px_1px_2px_0px_rgba(0,0,0,0.02)]'

function Header() {
  return (
    <div className="flex flex-col gap-[3px]">
      <div className="text-[16px] font-semibold leading-[22px] text-foreground">Why refunds happen</div>
      <div className="text-[14px] font-medium leading-5 text-muted-foreground">By total amount lost</div>
    </div>
  )
}

export function RefundReasons({ refunds, loaded }: RefundReasonsProps) {
  const map: Record<string, { cat: string; count: number; amount: number }> = {}
  refunds.forEach(r => {
    const k = categorizeReason(r.reason)
    if (!map[k]) map[k] = { cat: k, count: 0, amount: 0 }
    map[k].count++
    map[k].amount += parseFloat(String(r.refundAmount || 0))
  })
  const reasons = Object.values(map).sort((a, b) => b.amount - a.amount)
  const mx = Math.max(...reasons.map(r => r.amount), 1)

  if (!loaded) {
    return (
      <div className={`${CARD} flex flex-col gap-4`}>
        <Header />
        <div className="flex flex-col gap-3.5">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="flex flex-col gap-[7px]">
              <Skeleton className="h-[14px]" style={{ width: `${50 + i * 9}%` }} />
              <Skeleton className="h-2 rounded-[4px]" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (reasons.length === 0) {
    return (
      <div className={`${CARD} flex flex-col gap-4`}>
        <Header />
        <CardEmptyState icon={HelpCircle} title="No refund reasons yet" size="lg" />
      </div>
    )
  }

  return (
    <div className={`${CARD} flex flex-col gap-4`}>
      <Header />
      <div className="flex flex-col gap-[14px]">
        {reasons.map((r, i) => {
          const cc = CAT_COLORS[r.cat] || CAT_COLORS.Other
          return (
            <div key={r.cat} className="flex flex-col gap-[7px]">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-medium text-foreground-2">{r.cat}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] tabular-nums text-foreground-4">{fmtEur(r.amount)}</span>
                  <span className="text-[14px] font-bold tabular-nums text-foreground">
                    {((r.count / (refunds.length || 1)) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-[4px] bg-[#EEF0F3]">
                <div
                  className="h-full origin-left animate-grow-x rounded-[4px]"
                  style={{
                    width: `${(r.amount / mx) * 100}%`,
                    background: cc.chartColor || '#9CA3AF',
                    animationDelay: `${0.08 * i}s`,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
