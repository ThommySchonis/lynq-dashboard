'use client'

import { useMemo, useState } from 'react'
import { Clock, Search, Download } from 'lucide-react'
import { fmtDur, TEAM_KPI } from '@/lib/time-tracking-constants'
import { exportTimeCSV } from '@/lib/admin-utils'
import type { TimeFilter, TeamData } from '@/types/time-tracking'
import type { TimeSession } from '@/types/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import { FilterTabs } from './filter-tabs'
import { KpiCards } from './kpi-cards'
import { MemberRow } from './member-row'
import { AdminLogRow } from './admin-log-row'

interface TeamViewProps {
  data: TeamData
  filter: TimeFilter
  onFilterChange: (f: TimeFilter) => void
}

// Slug a string for filename use. Lowercased, ASCII alphanumeric + dashes.
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'all'
}

export function TeamView({ data, filter, onFilterChange }: TeamViewProps) {
  const { members = [], sessions = [], active_count = 0, paused_count = 0, client } = data
  const totalSec = members.reduce((sum, m) => sum + (m.worked_seconds || 0), 0)

  // user_id → TeamMember lookup, used by AdminLogRow to resolve
  // s.last_edit_by into a display name.
  const membersById = useMemo(() => {
    const map: Record<string, typeof members[number]> = {}
    for (const m of members) map[m.id] = m
    return map
  }, [members])

  // ─── Filter state (client-side, no extra API calls) ─────────────────
  const [agentSearch, setAgentSearch] = useState('')
  const [agentFilter, setAgentFilter] = useState<string>('all')

  const filteredSessions = useMemo(() => {
    const q = agentSearch.trim().toLowerCase()
    return sessions.filter(s => {
      const name = (s.member_name || '').toLowerCase()
      if (q && !name.includes(q)) return false
      if (agentFilter !== 'all' && s.agent_id !== agentFilter) return false
      return true
    })
  }, [sessions, agentSearch, agentFilter])

  const filtersDirty = agentSearch.trim().length > 0 || agentFilter !== 'all'

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

  function handleReset() {
    setAgentSearch('')
    setAgentFilter('all')
  }

  function handleExport() {
    // Re-use the existing exporter; runtime shape matches TimeSession
    // (the /api/time route adds member_name + member_email to each row).
    exportTimeCSV(filteredSessions as unknown as TimeSession[])
  }

  const workspaceSlug = slug(client?.company_name || 'workspace')
  const downloadName = `time-tracking-${workspaceSlug}-${filter}.csv`

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
        <div className="flex items-center justify-between gap-3 border-b border-black/6 px-4.5 py-3.5">
          <div>
            <div className="text-[13px] font-semibold text-foreground">Sessions</div>
            <div className="mt-0.5 text-xs text-gray-500">
              {filtersDirty
                ? `${filteredSessions.length} of ${sessions.length} sessions`
                : 'All sessions with end-of-day reports'}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={filteredSessions.length === 0}
            title={downloadName}
            className="h-8 gap-1.5 text-[12.5px]"
          >
            <Download size={13} strokeWidth={1.75} />
            Export CSV
          </Button>
        </div>

        {/* Filter row */}
        {sessions.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-black/5 px-4.5 py-2.5">
            <div className="relative w-full max-w-xs">
              <Search
                size={13}
                strokeWidth={1.75}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <Input
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                placeholder="Search members…"
                className="h-8 pl-8 text-[12.5px]"
              />
            </div>
            <Select value={agentFilter} onValueChange={(v) => setAgentFilter(v ?? 'all')}>
              <SelectTrigger className="h-8 w-[180px] text-[12.5px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All members</SelectItem>
                {members.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name || 'Unknown'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filtersDirty && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-8 text-[12.5px]"
              >
                Reset
              </Button>
            )}
          </div>
        )}

        {sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 py-12 px-4.5">
            <Clock className="h-3.5 w-3.5 text-gray-300" />
            <div className="text-sm font-medium text-foreground">No sessions yet</div>
            <div className="text-[13px] text-gray-500">Data will appear once team members clock in</div>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 py-12 px-4.5">
            <div className="text-sm font-medium text-foreground">No matches</div>
            <div className="text-[13px] text-gray-500">Try a different search or reset filters.</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[130px_110px_60px_60px_70px_50px_1fr_52px] gap-3 border-b border-black/5 px-4.5 py-2.5">
              {['Member', 'Date', 'In', 'Out', 'Hours', 'Emails', 'Summary', ''].map(h => (
                <div key={h} className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{h}</div>
              ))}
            </div>
            {filteredSessions.map(s => (
              <AdminLogRow
                key={s.id}
                session={s}
                canEdit
                membersById={membersById}
              />
            ))}
          </>
        )}
      </div>
    </>
  )
}
