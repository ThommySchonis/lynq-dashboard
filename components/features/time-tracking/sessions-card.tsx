'use client'

import { useMemo, useState } from 'react'
import { Clock, Search, Download } from 'lucide-react'
import { exportTimeCSV } from '@/lib/admin-utils'
import type { Session, TeamMember, TimeFilter } from '@/types/time-tracking'
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
import { AdminLogRow, SESSIONS_GRID } from './admin-log-row'

interface SessionsCardProps {
  sessions: Session[]
  members: TeamMember[]
  filter: TimeFilter
  clientName?: string
}

// Slug a string for filename use. Lowercased, ASCII alphanumeric + dashes.
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'all'
}

const COLUMNS = ['Member', 'Date', 'Clock in / out', 'Duration', 'Status', 'End-of-day report', '']

export function SessionsCard({ sessions, members, filter, clientName }: SessionsCardProps) {
  const [agentSearch, setAgentSearch] = useState('')
  const [agentFilter, setAgentFilter] = useState<string>('all')

  const membersById: Record<string, TeamMember> = {}
  for (const m of members) membersById[m.id] = m

  const filteredSessions = useMemo(() => {
    const q = agentSearch.trim().toLowerCase()
    return sessions.filter((s) => {
      const name = (s.member_name || '').toLowerCase()
      if (q && !name.includes(q)) return false
      if (agentFilter !== 'all' && s.agent_id !== agentFilter) return false
      return true
    })
  }, [sessions, agentSearch, agentFilter])

  const filtersDirty = agentSearch.trim().length > 0 || agentFilter !== 'all'

  function handleReset() {
    setAgentSearch('')
    setAgentFilter('all')
  }

  function handleExport() {
    // Re-use the existing exporter; runtime shape matches TimeSession
    // (the admin RPC adds member_name + member_email to each row).
    exportTimeCSV(filteredSessions as unknown as TimeSession[])
  }

  const downloadName = `time-tracking-${slug(clientName || 'workspace')}-${filter}.csv`

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pl-[22px] pr-5 pt-5 pb-[18px]">
        <div>
          <div className="text-base font-semibold text-foreground">Sessions</div>
          <div className="mt-[3px] text-sm text-foreground-3">
            {filtersDirty
              ? `${filteredSessions.length} of ${sessions.length} sessions`
              : 'All sessions with end-of-day reports'}
          </div>
        </div>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={filteredSessions.length === 0}
          title={downloadName}
          className="h-11 gap-1.5 rounded-lg px-4 text-sm font-semibold"
        >
          <Download size={16} strokeWidth={1.75} />
          Export CSV
        </Button>
      </div>

      {/* Search + filter (kept beyond Figma) */}
      {sessions.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border px-[22px] py-2.5">
          <div className="relative w-full max-w-xs">
            <Search
              size={14}
              strokeWidth={1.75}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-4"
            />
            <Input
              value={agentSearch}
              onChange={(e) => setAgentSearch(e.target.value)}
              placeholder="Search members…"
              className="h-9 pl-8 text-sm"
            />
          </div>
          <Select value={agentFilter} onValueChange={(v) => setAgentFilter(v ?? 'all')}>
            <SelectTrigger className="h-9 w-[180px] text-sm">
              <SelectValue>
                {(value: string | null) =>
                  value && value !== 'all' ? members.find((m) => m.id === value)?.name ?? value : 'All members'
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All members</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name || 'Unknown'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filtersDirty && (
            <Button variant="ghost" onClick={handleReset} className="h-9 text-sm">
              Reset
            </Button>
          )}
        </div>
      )}

      {sessions.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          body="Once team members start tracking time, their sessions will appear here."
        />
      ) : filteredSessions.length === 0 ? (
        <EmptyState title="No matches" body="Try a different search or reset filters." />
      ) : (
        <>
          <div className={`${SESSIONS_GRID} border-t border-border px-[22px] py-3`}>
            {COLUMNS.map((h, i) => (
              <div key={h || i} className="text-sm text-foreground-3">{h}</div>
            ))}
          </div>
          {filteredSessions.map((s) => (
            <AdminLogRow key={s.id} session={s} canEdit membersById={membersById} />
          ))}
        </>
      )}
    </div>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-2.5 border-t border-border px-[22px] py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
        <Clock className="h-[26px] w-[26px] text-foreground-4" strokeWidth={1.5} />
      </div>
      <div className="text-base font-semibold text-foreground">{title}</div>
      <div className="max-w-xs text-sm text-foreground-3">{body}</div>
    </div>
  )
}
