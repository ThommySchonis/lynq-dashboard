'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useTimeData } from '@/hooks/admin'
import { fmtSec, workedSec, exportTimeCSV } from '@/lib/admin-utils'
import { TimeMemberCard } from './time-member-card'
import { TimeSessionRow } from './time-session-row'

type TimeFilter = 'today' | 'week' | 'month'

const FILTERS: Array<{ id: TimeFilter; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
]

export function TimeView() {
  const [filter, setFilter] = useState<TimeFilter>('week')
  const { data: timeData, isLoading } = useTimeData(filter)

  const sessions = timeData?.sessions ?? []
  const members = timeData?.members ?? []
  const activeCount = timeData?.active_count ?? 0
  const pausedCount = timeData?.paused_count ?? 0
  const totalSec = sessions.reduce((sum, s) => sum + workedSec(s), 0)
  const completedSessions = sessions.filter((s) => s.clocked_out_at).length

  const metrics = [
    {
      label: 'Active now',
      value: activeCount,
      colorClass: 'text-emerald-600',
      sub: pausedCount > 0 ? `${pausedCount} on break` : null,
      subClass: 'text-amber-600',
    },
    { label: 'Total worked', value: fmtSec(totalSec), colorClass: 'text-foreground', sub: null, subClass: '' },
    { label: 'Sessions', value: completedSessions, colorClass: 'text-foreground', sub: null, subClass: '' },
    { label: 'Team members', value: members.length, colorClass: 'text-foreground', sub: null, subClass: '' },
  ]

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {FILTERS.map(({ id, label }) => (
            <Button
              key={id}
              variant={filter === id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(id)}
            >
              {label}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => exportTimeCSV(sessions)}>
          <Download size={14} className="mr-1.5" />
          Export CSV
        </Button>
      </div>

      {/* Summary metrics */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        {metrics.map(({ label, value, colorClass, sub, subClass }) => (
          <Card key={label}>
            <CardContent>
              <div className={`text-2xl font-extrabold leading-none tracking-tight ${colorClass}`}>
                {value}
              </div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {label}
              </div>
              {sub && (
                <div className={`mt-0.5 text-[11px] font-semibold ${subClass}`}>{sub}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent>
            <div className="py-8 text-center text-sm text-muted-foreground">
              No sessions in this period.
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* Per employee section */}
            {members.length > 0 && (
              <div className="px-4 pt-4">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Per employee
                </div>
                <div className="mb-4 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
                  {members.map((m) => (
                    <TimeMemberCard key={m.name} member={m} />
                  ))}
                </div>
                <div className="border-t border-border/30" />
              </div>
            )}

            {/* Session table */}
            <div className="px-4 pb-4">
              <div className="grid grid-cols-[140px_110px_65px_65px_70px_60px_1fr] gap-2.5 border-b border-border/30 py-2.5">
                {['Employee', 'Date', 'In', 'Out', 'Worked', 'Break', 'Report'].map((h) => (
                  <div
                    key={h}
                    className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
                  >
                    {h}
                  </div>
                ))}
              </div>
              {sessions.map((s) => (
                <TimeSessionRow key={s.id} session={s} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
