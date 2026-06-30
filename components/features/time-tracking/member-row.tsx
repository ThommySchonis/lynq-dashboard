'use client'

import { fmtDur } from '@/lib/time-tracking-constants'
import { formatRole } from '@/lib/utils'
import type { TeamMember } from '@/types/time-tracking'

interface MemberRowProps {
  member: TeamMember
}

export function MemberRow({ member: m }: MemberRowProps) {
  const active = m.is_active && !m.is_paused
  const paused = m.is_paused

  // Status pill styling. Active/On break carry a coloured dot; Offline is a
  // neutral chip with no dot. Token-based so it tracks the redesign + dark mode.
  const pill = paused
    ? { box: 'bg-warning-soft', text: 'text-warning', dot: 'bg-warning', label: 'On break' }
    : active
      ? { box: 'bg-success-soft', text: 'text-success', dot: 'bg-success', label: 'Active' }
      : { box: 'bg-secondary', text: 'text-foreground-3', dot: '', label: 'Offline' }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-[22px] py-3.5 last:border-b-0">
      {/* Avatar + name */}
      <div className="flex items-center gap-3">
        {/* Neutral grey chip — bg-foreground-4 / text-background reads in both themes */}
        <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-foreground-4 text-sm font-semibold text-background">
          {m.name?.charAt(0).toUpperCase() || '?'}
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="text-sm font-semibold text-foreground">{m.name}</div>
          <div className="text-sm font-medium text-foreground-3">{formatRole(m.role)}</div>
        </div>
      </div>

      {/* Hours + status */}
      <div className="flex w-[180px] items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="text-sm font-semibold tabular-nums text-foreground">{fmtDur(m.worked_seconds)}</div>
          <div className="text-xs text-foreground-3">
            {m.sessions_count} session{m.sessions_count !== 1 ? 's' : ''}
          </div>
        </div>
        <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[5px] ${pill.box}`}>
          {pill.dot && <div className={`h-[7px] w-[7px] shrink-0 rounded-full ${pill.dot}`} />}
          <span className={`text-xs font-semibold ${pill.text}`}>{pill.label}</span>
        </div>
      </div>
    </div>
  )
}
