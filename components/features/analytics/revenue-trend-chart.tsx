'use client'

import { TrendingUp } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { fmtEur } from '@/lib/analytics-constants'
import { CardEmptyState } from './card-empty-state'
import { ChartDateFooter } from './chart-date-footer'
import type { RevenueTrendPoint } from '@/types/analytics'

interface RevenueTrendChartProps {
  trend: RevenueTrendPoint[]
  loaded: boolean
  rangeLabel: string
}

// Card chrome shared across states (Figma 916-23651: white, 1px border, radius 16).
const CARD = 'mb-6 rounded-[16px] border border-border bg-card p-[22px_24px_20px]'

function fmtDay(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function Header({ total, rangeLabel, muted }: { total: number; rangeLabel: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-[3px]">
        <div className="text-[16px] font-semibold leading-[22px] text-foreground">Revenue Trend</div>
        <div className="text-[12px] font-medium leading-4 text-muted-foreground">{rangeLabel} &middot; daily net revenue</div>
      </div>
      <div className={`text-[20px] font-bold ${muted ? 'text-muted-foreground' : 'text-foreground'}`}>{fmtEur(total)}</div>
    </div>
  )
}

export function RevenueTrendChart({ trend, loaded, rangeLabel }: RevenueTrendChartProps) {
  if (!loaded) {
    return (
      <div className={CARD}>
        <Skeleton className="mb-1.5 h-[16px] w-[30%]" />
        <Skeleton className="mb-5 h-[12px] w-[20%]" />
        <Skeleton className="h-[222px] rounded-lg" />
      </div>
    )
  }

  if (!trend.length || trend.every(d => d.revenue === 0)) {
    return (
      <div className={`${CARD} animate-fade-up flex flex-col gap-[18px]`}>
        <Header total={0} rangeLabel={rangeLabel} muted />
        <CardEmptyState
          icon={TrendingUp}
          title="No revenue data yet"
          description="Daily net revenue will appear here once orders start coming in."
        />
      </div>
    )
  }

  // ── Chart geometry (viewBox matches Figma proportions: 1110 × 222) ──────────
  const W = 1110, H = 222, pL = 46, yT = 12, yB = 192
  const mx = Math.max(...trend.map(d => d.revenue), 1)
  const tot = trend.reduce((s, d) => s + d.revenue, 0)
  // Y-axis gridlines paired with their € value (€max / €mid / €0).
  const yAxis = [{ y: yT, v: mx }, { y: (yT + yB) / 2, v: mx / 2 }, { y: yB, v: 0 }]
  const pts = trend.map((d, i) => ({
    x: pL + (i / Math.max(trend.length - 1, 1)) * (W - pL),
    y: yB - (d.revenue / mx) * (yB - yT),
    ...d,
  }))
  const line = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const step = Math.ceil(trend.length / 6)
  const xlbls = pts.filter((_, i) => i === 0 || i % step === 0)
  const dateRangeLabel = `${fmtDay(trend[0].date)} – ${fmtDay(trend[trend.length - 1].date)}, ${new Date(trend[trend.length - 1].date + 'T00:00:00').getFullYear()}`

  return (
    <div className={`${CARD} animate-fade-up flex flex-col gap-[18px]`}>
      <Header total={tot} rangeLabel={rangeLabel} />

      {/* Chart */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden>
        {yAxis.map(({ y }, i) => (
          <line key={`g${i}`} x1={pL} y1={y} x2={W} y2={y} stroke="#EEF0F3" strokeWidth="1" />
        ))}
        {yAxis.map(({ y, v }, i) => {
          const lbl = v >= 1000 ? `€${(v / 1000).toFixed(1)}k` : `€${Math.round(v)}`
          return (
            <text key={`y${i}`} x={pL - 8} y={y + 4} textAnchor="end" fontSize="12" fill="#9CA3AF">
              {lbl}
            </text>
          )
        })}
        <polyline points={line} fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {xlbls.map((p, i) => (
          <text key={`x${i}`} x={p.x} y={yB + 18} textAnchor="middle" fontSize="12" fill="#9CA3AF">
            {fmtDay(p.date)}
          </text>
        ))}
      </svg>

      <ChartDateFooter dotClassName="bg-emerald-500" label={dateRangeLabel} />
    </div>
  )
}
