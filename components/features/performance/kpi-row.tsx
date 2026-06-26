'use client'

import { Skeleton } from '@/components/ui/skeleton'
import type { ResponseTimeData, ResolutionTimeData, AgentProductivityRow } from '@/types/support-analytics'

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60)
    const s = Math.round(seconds % 60)
    return s > 0 ? `${m}m ${s}s` : `${m}m`
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600)
    const m = Math.round((seconds % 3600) / 60)
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  const d = Math.floor(seconds / 86400)
  const h = Math.round((seconds % 86400) / 3600)
  return h > 0 ? `${d}d ${h}h` : `${d}d`
}

// ── Sub-components ───────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string
  isLoading: boolean
}

function KpiCard({ label, value, isLoading }: KpiCardProps) {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      {isLoading ? (
        <>
          <Skeleton className="mb-3 h-3 w-2/5" />
          <Skeleton className="h-7 w-3/5" />
        </>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold text-foreground">{value}</p>
        </>
      )}
    </div>
  )
}

// ── KpiRow ───────────────────────────────────────────────────────────────────

interface KpiRowProps {
  responseTime: ResponseTimeData | undefined
  resolutionTime: ResolutionTimeData | undefined
  agentProductivity: AgentProductivityRow[] | undefined
  isLoading: boolean
}

export function KpiRow({ responseTime, resolutionTime, agentProductivity, isLoading }: KpiRowProps) {
  const avgResponseTime = responseTime && responseTime.total_conversations > 0
    ? formatSeconds(responseTime.avg_response_time_seconds)
    : '—'

  const avgResolutionTime = resolutionTime && resolutionTime.total_resolved > 0
    ? formatSeconds(resolutionTime.avg_resolution_time_seconds)
    : '—'

  const ticketsResolved = agentProductivity
    ? agentProductivity.reduce((sum, row) => sum + row.tickets_resolved, 0).toLocaleString()
    : '—'

  const oneTouchRate = agentProductivity && agentProductivity.length > 0
    ? (() => {
        const totalResolved = agentProductivity.reduce((sum, row) => sum + row.tickets_resolved, 0)
        const totalOneTouch = agentProductivity.reduce((sum, row) => sum + row.one_touch_count, 0)
        return totalResolved > 0
          ? `${((totalOneTouch / totalResolved) * 100).toFixed(1)}%`
          : '0%'
      })()
    : '—'

  return (
    <div className="grid grid-cols-4 gap-4">
      <KpiCard label="Avg Response Time" value={avgResponseTime} isLoading={isLoading} />
      <KpiCard label="Avg Resolution Time" value={avgResolutionTime} isLoading={isLoading} />
      <KpiCard label="Tickets Resolved" value={ticketsResolved} isLoading={isLoading} />
      <KpiCard label="One-Touch Rate" value={oneTouchRate} isLoading={isLoading} />
    </div>
  )
}
