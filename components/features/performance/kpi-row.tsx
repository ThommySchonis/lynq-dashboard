'use client'

import { ArrowDown, ArrowUp } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatSeconds } from '@/lib/performance-utils'
import { computeDelta } from '@/lib/analytics-constants'
import type { Delta } from '@/types/analytics'
import type { ResponseTimeData, ResolutionTimeData, AgentProductivityRow } from '@/types/support-analytics'

// ── Helpers ─────────────────────────────────────────────────────────────────

function sumTicketsResolved(rows: AgentProductivityRow[]): number {
  return rows.reduce((sum, row) => sum + row.tickets_resolved, 0)
}

function oneTouchRate(rows: AgentProductivityRow[]): number {
  const resolved = sumTicketsResolved(rows)
  if (resolved === 0) return 0
  const oneTouch = rows.reduce((sum, row) => sum + row.one_touch_count, 0)
  return (oneTouch / resolved) * 100
}

// ── Delta badge ──────────────────────────────────────────────────────────────

function DeltaBadge({ delta, lowerIsBetter }: { delta: Delta; lowerIsBetter: boolean }) {
  if (delta.isNew) {
    return <span className="text-xs font-semibold text-foreground-3">New</span>
  }
  const improved = lowerIsBetter ? delta.pct < 0 : delta.pct > 0
  const Arrow = delta.pct > 0 ? ArrowUp : ArrowDown
  return (
    <span className={cn('flex items-center gap-1 text-xs font-semibold', improved ? 'text-success' : 'text-destructive')}>
      <Arrow size={12} />
      {Math.abs(Math.round(delta.pct))}% vs last period
    </span>
  )
}

// ── KPI card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string
  delta: Delta | null
  lowerIsBetter: boolean
  isLoading: boolean
}

function KpiCard({ label, value, delta, lowerIsBetter, isLoading }: KpiCardProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card pt-5 pr-[22px] pb-[22px] pl-[22px]">
        <Skeleton className="h-5 w-2/5" />
        <Skeleton className="h-[26px] w-3/5" />
      </div>
    )
  }
  return (
    <div className={cn('flex flex-col rounded-xl border border-border bg-card pt-5 pr-[22px] pb-[22px] pl-[22px]', delta ? 'gap-2' : 'gap-4')}>
      <p className="text-base font-medium leading-5 text-foreground-3">{label}</p>
      <p className="text-lg font-semibold leading-[26px] text-foreground">{value}</p>
      {delta && <DeltaBadge delta={delta} lowerIsBetter={lowerIsBetter} />}
    </div>
  )
}

// ── KpiRow ───────────────────────────────────────────────────────────────────

interface KpiRowProps {
  responseTime: ResponseTimeData | undefined
  resolutionTime: ResolutionTimeData | undefined
  agentProductivity: AgentProductivityRow[] | undefined
  prevResponseTime: ResponseTimeData | undefined
  prevResolutionTime: ResolutionTimeData | undefined
  prevAgentProductivity: AgentProductivityRow[] | undefined
  isLoading: boolean
  hasPrev: boolean
}

export function KpiRow({
  responseTime,
  resolutionTime,
  agentProductivity,
  prevResponseTime,
  prevResolutionTime,
  prevAgentProductivity,
  isLoading,
  hasPrev,
}: KpiRowProps) {
  const hasResponse = !!responseTime && responseTime.total_conversations > 0
  const hasResolution = !!resolutionTime && resolutionTime.total_resolved > 0

  const responseDelta = hasPrev && hasResponse && prevResponseTime
    ? computeDelta(responseTime.avg_response_time_seconds, prevResponseTime.avg_response_time_seconds)
    : null
  const resolutionDelta = hasPrev && hasResolution && prevResolutionTime
    ? computeDelta(resolutionTime.avg_resolution_time_seconds, prevResolutionTime.avg_resolution_time_seconds)
    : null
  const ticketsDelta = hasPrev && agentProductivity && prevAgentProductivity
    ? computeDelta(sumTicketsResolved(agentProductivity), sumTicketsResolved(prevAgentProductivity))
    : null
  const oneTouchDelta = hasPrev && agentProductivity && agentProductivity.length > 0 && prevAgentProductivity
    ? computeDelta(oneTouchRate(agentProductivity), oneTouchRate(prevAgentProductivity))
    : null

  return (
    <div className="grid grid-cols-4 gap-4">
      <KpiCard
        label="Avg Response Time"
        value={hasResponse ? formatSeconds(responseTime.avg_response_time_seconds) : '—'}
        delta={responseDelta}
        lowerIsBetter
        isLoading={isLoading}
      />
      <KpiCard
        label="Avg Resolution Time"
        value={hasResolution ? formatSeconds(resolutionTime.avg_resolution_time_seconds) : '—'}
        delta={resolutionDelta}
        lowerIsBetter
        isLoading={isLoading}
      />
      <KpiCard
        label="Tickets Resolved"
        value={agentProductivity ? sumTicketsResolved(agentProductivity).toLocaleString() : '—'}
        delta={ticketsDelta}
        lowerIsBetter={false}
        isLoading={isLoading}
      />
      <KpiCard
        label="One-Touch Rate"
        value={agentProductivity && agentProductivity.length > 0 ? `${oneTouchRate(agentProductivity).toFixed(0)}%` : '—'}
        delta={oneTouchDelta}
        lowerIsBetter={false}
        isLoading={isLoading}
      />
    </div>
  )
}
