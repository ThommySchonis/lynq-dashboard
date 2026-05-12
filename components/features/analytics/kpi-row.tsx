'use client'

import { ArrowDown, ArrowUp, BarChart3, Clock, Receipt, TrendingDown } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useCountUp } from '@/hooks/use-count-up'
import { computeDelta, fmtEur } from '@/lib/analytics-constants'
import type { KpiData, PrevKpiData, Refund, Delta } from '@/types/analytics'

// ── Sub-components ─────────────────────────────────────────────────────────

interface DeltaBadgeProps {
  delta: Delta | null
  lowerIsBetter?: boolean
}

function DeltaBadge({ delta, lowerIsBetter = true }: DeltaBadgeProps) {
  if (!delta) return null
  const improved = lowerIsBetter ? delta.pct < 0 : delta.pct > 0
  const Arrow = delta.pct > 0 ? ArrowUp : ArrowDown

  return (
    <div className={`flex items-center gap-0.5 text-xs font-medium tracking-tight ${improved ? 'text-emerald-500' : 'text-red-600'}`}>
      <Arrow size={12} />
      <span>{Math.abs(delta.pct).toFixed(1)}%</span>
      <span className="text-[11px] font-normal text-gray-400 opacity-55">vs prev</span>
    </div>
  )
}

// ── KPI card icons ─────────────────────────────────────────────────────────

const CARD_ICONS = [TrendingDown, Receipt, BarChart3, Clock] as const

// ── Single KPI card ────────────────────────────────────────────────────────

interface KpiCardConfig {
  label: string
  rawValue: number
  sub: string
  delta: Delta | null
  lowerBetter: boolean
}

interface KpiCardInnerProps {
  c: KpiCardConfig
  index: number
  hasPrevKpis: boolean
}

function KpiCardInner({ c, index, hasPrevKpis }: KpiCardInnerProps) {
  const animCount = useCountUp(
    index === 0 ? Math.round(c.rawValue * 100)
      : index === 2 ? Math.round(c.rawValue * 10)
        : index === 3 ? Math.round(c.rawValue * 100)
          : c.rawValue
  )

  let displayVal: string
  if (index === 0) displayVal = `\u20AC${(animCount / 100).toFixed(2)}`
  else if (index === 1) displayVal = animCount.toLocaleString()
  else if (index === 2) displayVal = `${(animCount / 10).toFixed(1)}%`
  else displayVal = `\u20AC${(animCount / 100).toFixed(2)}`

  const Icon = CARD_ICONS[index]

  return (
    <div className="animate-fade-up rounded-[10px] border border-black/[0.07] bg-white p-[18px_20px] relative overflow-hidden transition-all duration-200 hover:border-black/[0.12] hover:shadow-md hover:-translate-y-px">
      <div className="mb-3.5 flex items-start justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[.06em] text-gray-400">
          {c.label}
        </div>
        <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[7px] bg-purple-500/[0.08]">
          <Icon size={14} className="text-foreground-4" />
        </div>
      </div>
      <div className="mb-2 text-2xl font-bold leading-none text-gray-900 tabular-nums">
        {displayVal}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] text-gray-400">{c.sub}</div>
        <DeltaBadge delta={hasPrevKpis ? c.delta : null} lowerIsBetter={c.lowerBetter} />
      </div>
    </div>
  )
}

// ── KPI Row ────────────────────────────────────────────────────────────────

interface KpiRowProps {
  kpis: KpiData
  prevKpis: PrevKpiData
  refunds: Refund[]
  loaded: { kpis: boolean; prevKpis: boolean; refunds: boolean }
}

export function KpiRow({ kpis, prevKpis, refunds, loaded }: KpiRowProps) {
  const totalRef = refunds.reduce((s, r) => s + parseFloat(String(r.refundAmount || 0)), 0)
  const count = refunds.length
  const avg = count > 0 ? totalRef / count : 0
  const rate = parseFloat(String(kpis.refundRate || 0))
  const prevRef = parseFloat(String(prevKpis.refundAmount || 0))
  const prevRate = parseFloat(String(prevKpis.refundRate || 0))
  const prevCount = prevKpis.totalRefunds || 0
  const prevAvg = prevCount > 0 ? prevRef / prevCount : 0

  const isHealthy = rate === 0 && loaded.kpis && loaded.refunds

  if (!loaded.kpis && !loaded.refunds) {
    return (
      <div className="mb-7 grid grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="animate-fade-up rounded-[10px] border border-white/65 bg-white/80 p-[18px_20px] shadow-sm backdrop-blur-xl">
            <Skeleton className="mb-3.5 h-[11px] w-[55%]" />
            <Skeleton className="mb-2 h-[30px] w-[70%]" />
            <Skeleton className="h-[9px] w-[85%]" />
          </div>
        ))}
      </div>
    )
  }

  const cards: KpiCardConfig[] = [
    {
      label: 'REFUNDS THIS PERIOD',
      rawValue: totalRef,
      sub: `${count} refunded order${count !== 1 ? 's' : ''}`,
      delta: computeDelta(totalRef, prevRef),
      lowerBetter: true,
    },
    {
      label: 'TOTAL REFUNDS',
      rawValue: count,
      sub: 'fully or partially refunded',
      delta: computeDelta(count, prevCount),
      lowerBetter: true,
    },
    {
      label: 'REFUND RATE',
      rawValue: rate,
      sub: isHealthy ? 'Below average' : rate > 5 ? `${(rate / 2.5).toFixed(1)}\u00D7 above avg` : 'Industry avg: 2\u20135%',
      delta: computeDelta(rate, prevRate),
      lowerBetter: true,
    },
    {
      label: 'AVG REFUND',
      rawValue: avg,
      sub: 'per refunded order',
      delta: computeDelta(avg, prevAvg),
      lowerBetter: true,
    },
  ]

  return (
    <div className="mb-6 grid grid-cols-4 gap-4">
      {cards.map((c, i) => (
        <KpiCardInner key={c.label} c={c} index={i} hasPrevKpis={loaded.prevKpis} />
      ))}
    </div>
  )
}
