'use client'

import { PieChart } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { categorizeReason, CAT_COLORS } from '@/lib/analytics-constants'
import { CardEmptyState } from './card-empty-state'
import type { Refund } from '@/types/analytics'

interface DonutReasonChartProps {
  refunds: Refund[]
  loaded: boolean
}

// Card chrome (Figma 916-23959): white, 1px border, radius 16, soft elevation.
const CARD = 'flex-1 rounded-[16px] border border-border bg-card p-[22px_24px] shadow-card'

function Header() {
  return (
    <div className="flex flex-col gap-[3px]">
      <div className="text-[16px] font-semibold leading-[22px] text-foreground">Refund Reasons</div>
      <div className="text-[14px] font-medium leading-5 text-muted-foreground">Distribution this period</div>
    </div>
  )
}

export function DonutReasonChart({ refunds, loaded }: DonutReasonChartProps) {
  if (!loaded) {
    return (
      <div className={CARD}>
        <Skeleton className="mb-1.5 h-[16px] w-[55%]" />
        <Skeleton className="mb-5 h-[12px] w-[35%]" />
        <Skeleton className="mx-auto h-[150px] w-[150px] rounded-full" />
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
      <div className={`${CARD} flex flex-col gap-4`}>
        <Header />
        <CardEmptyState
          icon={PieChart}
          title="No refunds this period"
          description="Reason breakdown will appear here once you have refunds."
        />
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

  const r = 60
  const C = 2 * Math.PI * r
  const slices = segments.map((s, i) => {
    const prevCum = segments.slice(0, i).reduce((acc, seg) => acc + (seg.val / total) * C, 0)
    const dashLen = (s.val / total) * C - 1.5
    return { ...s, dashLen: Math.max(dashLen, 0), offset: -prevCum }
  })

  return (
    <div className={`${CARD} flex flex-col gap-4`}>
      <Header />
      <div className="flex items-center gap-7 py-2">
        {/* Donut */}
        <div className="relative h-[150px] w-[150px] shrink-0">
          <svg viewBox="0 0 150 150" className="h-[150px] w-[150px] -rotate-90" aria-hidden>
            <circle cx="75" cy="75" r={r} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="22" />
            {slices.map((s, i) => (
              <circle
                key={i}
                cx="75"
                cy="75"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="22"
                strokeDasharray={`${s.dashLen} ${C}`}
                strokeDashoffset={s.offset}
                strokeLinecap="butt"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[28px] font-bold leading-[32px] tracking-[-0.02em] text-foreground">{total}</div>
            <div className="text-[12px] font-semibold uppercase leading-[14px] tracking-[0.08em] text-foreground-4">refunds</div>
          </div>
        </div>
        {/* Legend */}
        <div className="flex flex-1 flex-col gap-[15px]">
          {segments.map(s => (
            <div key={s.cat} className="flex items-center gap-2.5">
              <span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="flex-1 truncate text-[14px] font-medium text-foreground">{s.cat}</span>
              <span className="shrink-0 text-[12px] tabular-nums text-foreground-4">{s.val}&times;</span>
              <span className="w-10 shrink-0 text-right text-[14px] font-semibold tabular-nums text-foreground">{s.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
