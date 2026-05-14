'use client'

import { Clock } from 'lucide-react'
import { fmtDur, TEAM_KPI } from '@/lib/time-tracking-constants'
import type { TimeFilter, TeamData } from '@/types/time-tracking'
import { FilterTabs } from './filter-tabs'
import { KpiCards } from './kpi-cards'
import { MemberRow } from './member-row'
import { AdminLogRow } from './admin-log-row'

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
    <>
      {/* Header */}
      <div className="mb-7 animate-fade-up">
        <h1 className="mb-1 text-xl font-bold tracking-tight text-foreground">
          Team Time Tracking
        </h1>
        <div className="mb-4 text-[13px] text-gray-500">
          {client ? client.company_name : 'All clients'} &middot; {active_count + paused_count} active now
        </div>
        <FilterTabs filter={filter} onChange={onFilterChange} />
      </div>

      {/* KPIs */}
      <div className="mb-4">
        <KpiCards cards={kpiCards} columns={4} />
      </div>

      {/* Team Members */}
      <div className="mb-3.5 overflow-hidden rounded-[10px] border border-black/7 bg-white opacity-0 animate-fade-up delay-100">
        <div className="border-b border-black/6 px-4.5 py-3.5">
          <div className="text-[13px] font-semibold text-foreground">Team Members</div>
          <div className="mt-0.5 text-xs text-gray-500">Status and hours per member this period</div>
        </div>
        {members.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 py-12 px-4.5">
            <Clock className="h-3.5 w-3.5 text-gray-300" />
            <div className="text-sm font-medium text-foreground">No team members</div>
            <div className="text-[13px] text-gray-500">Add team members via the admin panel</div>
          </div>
        ) : (
          members.map(m => <MemberRow key={m.id} member={m} />)
        )}
      </div>

      {/* Sessions table */}
      <div className="overflow-hidden rounded-[10px] border border-black/7 bg-white opacity-0 animate-fade-up delay-150">
        <div className="border-b border-black/6 px-4.5 py-3.5">
          <div className="text-[13px] font-semibold text-foreground">Sessions</div>
          <div className="mt-0.5 text-xs text-gray-500">All sessions with end-of-day reports</div>
        </div>
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 py-12 px-4.5">
            <Clock className="h-3.5 w-3.5 text-gray-300" />
            <div className="text-sm font-medium text-foreground">No sessions yet</div>
            <div className="text-[13px] text-gray-500">Data will appear once team members clock in</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[130px_110px_60px_60px_70px_50px_1fr_24px] gap-3 border-b border-black/5 px-4.5 py-2.5">
              {['Member', 'Date', 'In', 'Out', 'Hours', 'Emails', 'Summary', ''].map(h => (
                <div key={h} className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{h}</div>
              ))}
            </div>
            {sessions.map(s => <AdminLogRow key={s.id} session={s} />)}
          </>
        )}
      </div>
    </>
  )
}
