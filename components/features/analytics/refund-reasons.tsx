'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { categorizeReason, CAT_COLORS, fmtEur } from '@/lib/analytics-constants'
import type { Refund } from '@/types/analytics'

interface RefundReasonsProps {
  refunds: Refund[]
  loaded: boolean
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

  return (
    <div className="flex-1 rounded-xl border border-white/65 bg-white/80 p-[22px_24px] shadow-sm backdrop-blur-xl transition-shadow duration-200 hover:shadow-lg">
      <div className="mb-[18px]">
        <div className="mb-0.5 text-[13px] font-semibold text-[var(--text-1)]">Why refunds happen</div>
        <div className="text-[11px] text-[var(--text-3)]">By total amount lost</div>
      </div>

      {!loaded ? (
        <div className="flex flex-col gap-3.5">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-[11px]" style={{ width: `${50 + i * 9}%` }} />
              <Skeleton className="h-[5px] rounded-full" />
            </div>
          ))}
        </div>
      ) : reasons.length === 0 ? (
        <div className="py-8 text-center text-xs text-[var(--text-3)]">No data this period</div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {reasons.map((r, i) => {
            const cc = CAT_COLORS[r.cat] || CAT_COLORS.Other
            const barClr = cc.chartColor || '#9CA3AF'
            return (
              <div key={r.cat}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[13px] text-gray-600">{r.cat}</span>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className="text-[11px] tabular-nums text-gray-400">{fmtEur(r.amount)}</span>
                    <span className="min-w-[28px] text-right text-xs font-semibold tabular-nums text-gray-900">
                      {((r.count / (refunds.length || 1)) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 overflow-hidden rounded-[3px] bg-gray-100">
                  <div
                    className="h-full origin-left animate-grow-x rounded-[3px]"
                    style={{
                      width: `${(r.amount / mx) * 100}%`,
                      background: barClr,
                      animationDelay: `${0.08 * i}s`,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
