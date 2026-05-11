'use client'

import type { TimeMember } from '@/types/admin'
import { fmtSec } from '@/lib/admin-utils'

interface TimeMemberCardProps {
  member: TimeMember
}

export function TimeMemberCard({ member: m }: TimeMemberCardProps) {
  const borderClass = m.is_paused
    ? 'border-amber-500/20'
    : m.is_active
      ? 'border-emerald-500/15'
      : 'border-border/40'

  return (
    <div className={`rounded-[9px] border bg-muted/50 px-3.5 py-3 ${borderClass}`}>
      <div className="mb-2 flex items-center gap-1.5">
        <div
          className={`size-[7px] shrink-0 rounded-full ${
            m.is_paused ? 'bg-amber-400' : m.is_active ? 'bg-emerald-500' : 'bg-muted-foreground/30'
          }`}
        />
        <div className="text-[12.5px] font-semibold text-foreground">{m.name}</div>
        {m.is_paused && (
          <span className="ml-auto rounded border border-amber-500/20 bg-amber-500/8 px-1.5 py-px text-[10px] font-semibold text-amber-600">
            Break
          </span>
        )}
        {m.is_active && !m.is_paused && (
          <span className="ml-auto rounded border border-emerald-500/20 bg-emerald-500/8 px-1.5 py-px text-[10px] font-semibold text-emerald-600">
            Active
          </span>
        )}
      </div>
      <div className="mb-1 text-[22px] font-extrabold tracking-tight text-foreground">
        {fmtSec(m.worked_seconds)}
      </div>
      <div className="flex gap-2.5 text-[11px] text-muted-foreground">
        <span>
          {m.sessions_count} session{m.sessions_count !== 1 ? 's' : ''}
        </span>
        {m.paused_seconds > 0 && (
          <span className="text-amber-600">Break {fmtSec(m.paused_seconds)}</span>
        )}
      </div>
    </div>
  )
}
