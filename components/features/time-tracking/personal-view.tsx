'use client'

import { FILTERS, EMP_KPI, fmtDur } from '@/lib/time-tracking-constants'
import type { TimeFilter, Session } from '@/types/time-tracking'
import { FilterTabs } from './filter-tabs'
import { KpiCards } from './kpi-cards'
import { WorkLog } from './work-log'

interface PersonalViewProps {
  sessions: Session[]
  todaySeconds: number
  filter: TimeFilter
  onFilterChange: (f: TimeFilter) => void
  /** Live clock state from the page header — folded into the TODAY KPI. */
  isActive: boolean
  elapsed: number
}

export function PersonalView({
  sessions,
  todaySeconds,
  filter,
  onFilterChange,
  isActive,
  elapsed,
}: PersonalViewProps) {
  const filterLabel = FILTERS.find((f) => f.id === filter)?.label || 'This week'

  const totalPeriodSec = sessions.reduce((sum, s) => {
    if (!s.clocked_out_at) return sum
    const total = Math.round(
      (new Date(s.clocked_out_at).getTime() - new Date(s.clocked_in_at).getTime()) / 1000
    )
    return sum + Math.max(0, total - (s.paused_seconds || 0))
  }, 0)

  const empKpiCards = [
    {
      id: EMP_KPI[0].key,
      label: filterLabel.toUpperCase(),
      value: fmtDur(totalPeriodSec),
      sub: `${sessions.length} session${sessions.length !== 1 ? 's' : ''}`,
    },
    {
      id: EMP_KPI[1].key,
      label: EMP_KPI[1].label || 'TODAY',
      value: fmtDur(todaySeconds + (isActive ? elapsed : 0)),
      sub: 'Hours clocked today',
    },
    {
      id: EMP_KPI[2].key,
      label: EMP_KPI[2].label || 'AVG PER DAY',
      value: (() => {
        if (sessions.length === 0) return '—'
        const days = filter === 'today' ? 1 : filter === 'week' ? 7 : new Date().getDate()
        return fmtDur(totalPeriodSec / Math.max(1, days))
      })(),
      sub: 'Daily average',
    },
  ]

  return (
    <div className="space-y-6">
      <FilterTabs filter={filter} onChange={onFilterChange} />
      <KpiCards cards={empKpiCards} columns={3} />
      <WorkLog sessions={sessions} />
    </div>
  )
}
