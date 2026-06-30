'use client'

import { fmtDur, TEAM_KPI } from '@/lib/time-tracking-constants'
import type { TimeFilter, TeamData } from '@/types/time-tracking'
import { FilterTabs } from './filter-tabs'
import { KpiCards } from './kpi-cards'
import { TeamMembersCard } from './team-members-card'
import { SessionsCard } from './sessions-card'

interface TeamViewProps {
  data: TeamData
  filter: TimeFilter
  onFilterChange: (f: TimeFilter) => void
}

export function TeamView({ data, filter, onFilterChange }: TeamViewProps) {
  const { members = [], sessions = [], active_count = 0, paused_count = 0, client } = data
  const totalSec = members.reduce((sum, m) => sum + (m.worked_seconds || 0), 0)

  const kpiCards = TEAM_KPI.map(({ key, label }) => ({
    id: key,
    label,
    value: key === 'active' ? String(active_count)
      : key === 'break' ? String(paused_count)
      : key === 'total' ? fmtDur(totalSec)
      : String(members.length),
    sub: key === 'active' ? 'clocked in'
      : key === 'break' ? 'paused'
      : key === 'total' ? `${sessions.length} sessions`
      : 'members',
  }))

  return (
    <div className="space-y-6">
      <FilterTabs filter={filter} onChange={onFilterChange} />
      <KpiCards cards={kpiCards} columns={4} />
      <TeamMembersCard members={members} />
      <SessionsCard sessions={sessions} members={members} filter={filter} clientName={client?.company_name} />
    </div>
  )
}
