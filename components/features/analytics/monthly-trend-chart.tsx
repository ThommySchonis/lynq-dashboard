'use client'

import { BarChart3 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { buildMonthlyTrend, fmtEur } from '@/lib/analytics-constants'
import { CardEmptyState } from './card-empty-state'
import type { Refund } from '@/types/analytics'

interface MonthlyTrendChartProps {
  allRefunds: Refund[]
  loaded: boolean
}

// Card chrome (Figma 916-24037): white, 1px gray-lavender border, radius 16.
const CARD = 'flex-1 rounded-[16px] border border-[#ECEAF3] bg-card p-6'

function Header({ total }: { total?: number }) {
  return (
    <div className="flex items-start justify-between">
      <div className="flex flex-col gap-1">
        <div className="text-[14px] font-semibold leading-5 text-foreground">Monthly Refunds</div>
        <div className="text-[14px] font-normal leading-5 text-muted-foreground">Last 6 months — count + amount</div>
      </div>
      {total !== undefined && (
        <div className="text-[14px] font-semibold leading-5 text-red-500">{fmtEur(total)}</div>
      )}
    </div>
  )
}

export function MonthlyTrendChart({ allRefunds, loaded }: MonthlyTrendChartProps) {
  if (!loaded) {
    return (
      <div className={CARD}>
        <Skeleton className="mb-1.5 h-[14px] w-[50%]" />
        <Skeleton className="mb-5 h-[14px] w-[30%]" />
        <Skeleton className="h-[184px] rounded-lg" />
      </div>
    )
  }

  const months = buildMonthlyTrend(allRefunds)
  const maxCount = Math.max(...months.map(m => m.count), 1)
  const maxAmt = Math.max(...months.map(m => m.amount), 1)
  const totalLost = months.reduce((s, m) => s + m.amount, 0)
  const totalCount = months.reduce((s, m) => s + m.count, 0)

  if (totalCount === 0) {
    return (
      <div className={`${CARD} flex flex-col gap-[14px]`}>
        <Header />
        <CardEmptyState
          icon={BarChart3}
          title="No refunds in this period"
          description="Monthly refund counts will appear here."
        />
      </div>
    )
  }

  // ── Chart geometry (viewBox matches Figma proportions: 529 × 184) ───────────
  const W = 529, H = 184, barW = 60, gap = 25.4, x0 = 21, baseline = 150, maxBarH = 116
  const bx = (i: number) => x0 + i * (barW + gap)
  const cx = (i: number) => bx(i) + barW / 2
  const barH = (c: number) => (c / maxCount) * maxBarH
  const amtY = (a: number) => 134 - (a / maxAmt) * 48 // gentle line band over the bars
  const linePts = months.map((m, i) => `${cx(i).toFixed(1)},${amtY(m.amount).toFixed(1)}`).join(' ')

  // Date-range footer label (mirrors buildMonthlyTrend's 6-month window)
  const now = new Date()
  const firstYear = new Date(now.getFullYear(), now.getMonth() - 5, 1).getFullYear()
  const yearLabel = firstYear === now.getFullYear() ? `${now.getFullYear()}` : `${firstYear}–${now.getFullYear()}`
  const dateRangeLabel = `${months[0].label} – ${months[months.length - 1].label}, ${yearLabel}`

  return (
    <div className={`${CARD} flex flex-col gap-[14px]`}>
      <Header total={totalLost} />

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden>
        {months.map((m, i) => {
          const h = barH(m.count)
          return (
            <g key={i}>
              {h > 0 && <rect x={bx(i)} y={baseline - h} width={barW} height={h} rx="7" fill="#E7E8EC" />}
              {m.count > 0 && (
                <text x={cx(i)} y={baseline - h - 8} textAnchor="middle" fontSize="12" fontWeight="600" fill="#6B7280">
                  {m.count}
                </text>
              )}
              <text
                x={cx(i)}
                y={172}
                textAnchor="middle"
                fontSize="12"
                fontWeight={m.isCurrentMonth ? 600 : 500}
                fill={m.isCurrentMonth ? '#0F0F10' : '#9CA3AF'}
              >
                {m.label}
              </text>
            </g>
          )
        })}
        <polyline points={linePts} fill="none" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {months.map((m, i) => (
          <circle key={`d${i}`} cx={cx(i)} cy={amtY(m.amount)} r="4" fill="#8B5CF6" stroke="#FFFFFF" strokeWidth="2" />
        ))}
      </svg>

      {/* Date range footer */}
      <div className="flex items-center justify-center gap-2.5">
        <span className="h-0.5 w-3.5 rounded-full bg-red-500" />
        <span className="text-[12px] font-medium leading-4 text-foreground-4">{dateRangeLabel}</span>
      </div>
    </div>
  )
}
