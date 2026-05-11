'use client'

import { fmtDur } from '@/lib/time-tracking-constants'
import type { TeamMember } from '@/types/time-tracking'

interface MemberRowProps {
  member: TeamMember
}

export function MemberRow({ member: m }: MemberRowProps) {
  const active = m.is_active && !m.is_paused
  const paused = m.is_paused

  const dotColor = paused ? 'bg-amber-500' : active ? 'bg-emerald-500' : 'bg-gray-300'
  const badgeBg = paused ? 'bg-amber-500/8' : active ? 'bg-emerald-500/8' : 'bg-gray-100'
  const badgeBorder = paused ? 'border-amber-500/20' : active ? 'border-emerald-500/15' : 'border-black/8'
  const badgeColor = paused ? 'text-amber-600' : active ? 'text-emerald-600' : 'text-gray-400'
  const badgeLabel = paused ? 'Paused' : active ? 'Online' : 'Offline'

  return (
    <div className="flex cursor-default items-center gap-3 border-b border-black/5 px-4.5 py-3 transition-colors last:border-b-0 hover:bg-[#F9F8FF]">
      {/* Avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/7 bg-gray-100 text-xs font-semibold text-gray-600">
        {m.name?.charAt(0).toUpperCase() || '?'}
      </div>

      {/* Name + role */}
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-[#0F0F10]">{m.name}</div>
        <div className="text-xs text-gray-500">{m.role}</div>
      </div>

      {/* Hours */}
      <div className="mr-4 shrink-0 text-right">
        <div className="text-[13px] font-semibold text-[#0F0F10] tabular-nums">{fmtDur(m.worked_seconds)}</div>
        <div className="text-[11px] text-gray-400">{m.sessions_count} session{m.sessions_count !== 1 ? 's' : ''}</div>
      </div>

      {/* Status badge */}
      <div className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 ${badgeBg} ${badgeBorder}`}>
        <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor} ${active ? 'animate-[pulse_2s_ease-in-out_infinite]' : ''}`} />
        <span className={`text-[11px] font-semibold ${badgeColor}`}>{badgeLabel}</span>
      </div>
    </div>
  )
}
