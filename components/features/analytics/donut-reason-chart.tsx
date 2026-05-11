'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { categorizeReason, CAT_COLORS } from '@/lib/analytics-constants'
import type { Refund } from '@/types/analytics'

interface DonutReasonChartProps {
  refunds: Refund[]
  loaded: boolean
}

export function DonutReasonChart({ refunds, loaded }: DonutReasonChartProps) {
  if (!loaded) {
    return (
      <div className="flex-1 rounded-xl border border-white/65 bg-white/80 p-[22px_24px] shadow-sm backdrop-blur-xl">
        <Skeleton className="mb-1.5 h-[13px] w-[55%]" />
        <Skeleton className="mb-5 h-[10px] w-[35%]" />
        <Skeleton className="mx-auto h-40 w-40 rounded-full" />
      </div>
    )
  }

  const map: Record<string, number> = {}
  refunds.forEach(r => {
    const c = categorizeReason(r.reason)
    map[c] = (map[c] || 0) + 1
  })
  const total = Object.values(map).reduce((s, v) => s + v, 0)

  if (total === 0) {
    return (
      <div className="flex min-h-[200px] flex-1 flex-col items-center justify-center rounded-xl border border-white/65 bg-white/80 p-[22px_24px] shadow-sm backdrop-blur-xl">
        <div className="text-[13px] text-[var(--text-3)]">No refund reasons this period</div>
      </div>
    )
  }

  const segments = Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, val]) => ({
      cat,
      val,
      color: (CAT_COLORS[cat] || CAT_COLORS.Other).chartColor,
      pct: ((val / total) * 100).toFixed(0),
    }))

  const r = 58
  const C = 2 * Math.PI * r
  let cum = 0
  const slices = segments.map(s => {
    const dashLen = (s.val / total) * C - 1.5
    const offset = -cum
    cum += (s.val / total) * C
    return { ...s, dashLen: Math.max(dashLen, 0), offset }
  })

  return (
    <div className="flex-1 rounded-xl border border-white/65 bg-white/80 p-[22px_24px] shadow-sm backdrop-blur-xl transition-shadow duration-200 hover:shadow-lg">
      <div className="mb-[18px]">
        <div className="mb-0.5 text-[13px] font-semibold text-[var(--text-1)]">Refund Reasons</div>
        <div className="text-[11px] text-[var(--text-3)]">Distribution this period</div>
      </div>
      <div className="flex items-center gap-6">
        {/* Donut */}
        <div className="relative h-[130px] w-[130px] shrink-0">
          <svg viewBox="0 0 130 130" className="h-[130px] w-[130px] -rotate-90" aria-hidden>
            <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="18" />
            {slices.map((s, i) => (
              <circle
                key={i}
                cx="65"
                cy="65"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="18"
                strokeDasharray={`${s.dashLen} ${C}`}
                strokeDashoffset={s.offset}
                strokeLinecap="butt"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[22px] font-extrabold leading-none tracking-tighter text-[var(--text-1)]">{total}</div>
            <div className="text-[9.5px] font-semibold uppercase tracking-[.06em] text-[var(--text-3)]">refunds</div>
          </div>
        </div>
        {/* Legend */}
        <div className="flex flex-1 flex-col gap-2">
          {segments.map(s => (
            <div key={s.cat} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-[7px]">
                <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="text-[11.5px] font-medium text-gray-600">{s.cat}</span>
              </div>
              <div className="flex shrink-0 items-center gap-[7px]">
                <span className="text-[11px] tabular-nums text-gray-400">{s.val}&times;</span>
                <span className="min-w-[28px] text-right text-[11px] font-semibold text-gray-900">{s.pct}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
