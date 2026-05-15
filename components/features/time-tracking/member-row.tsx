'use client'

import { fmtDur } from '@/lib/time-tracking-constants'
import { formatRole } from '@/lib/utils'
import type { TeamMember } from '@/types/time-tracking'

interface MemberRowProps {
  member: TeamMember
}

// Deterministic pastel palette indexed by a tiny hash of the user_id.
// Same id → same colour across re-renders, no per-row randomness.
const AVATAR_PALETTE = [
  { bg: 'bg-rose-100',    fg: 'text-rose-700'    },
  { bg: 'bg-amber-100',   fg: 'text-amber-700'   },
  { bg: 'bg-emerald-100', fg: 'text-emerald-700' },
  { bg: 'bg-sky-100',     fg: 'text-sky-700'     },
  { bg: 'bg-violet-100',  fg: 'text-violet-700'  },
  { bg: 'bg-fuchsia-100', fg: 'text-fuchsia-700' },
  { bg: 'bg-teal-100',    fg: 'text-teal-700'    },
  { bg: 'bg-orange-100',  fg: 'text-orange-700'  },
] as const

function pickAvatarColors(id: string): typeof AVATAR_PALETTE[number] {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}

export function MemberRow({ member: m }: MemberRowProps) {
  const active = m.is_active && !m.is_paused
  const paused = m.is_paused

  const badgeBg     = paused ? 'bg-amber-100'  : active ? 'bg-green-100'  : 'bg-gray-100'
  const badgeColor  = paused ? 'text-amber-700' : active ? 'text-green-700' : 'text-gray-600'
  const badgeLabel  = paused ? 'On break'      : active ? 'Active'        : 'Offline'

  const avatar = pickAvatarColors(m.id)

  return (
    <div className="flex cursor-default items-center gap-3 border-b border-gray-200/40 px-4.5 py-3 transition-colors last:border-b-0 hover:bg-gray-50/60">
      {/* Avatar — deterministic pastel per user_id */}
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatar.bg} ${avatar.fg}`}>
        {m.name?.charAt(0).toUpperCase() || '?'}
      </div>

      {/* Name + role */}
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-foreground">{m.name}</div>
        <div className="text-xs text-gray-500">{formatRole(m.role)}</div>
      </div>

      {/* Hours */}
      <div className="mr-4 shrink-0 text-right">
        <div className="text-[13px] font-semibold text-foreground tabular-nums">{fmtDur(m.worked_seconds)}</div>
        <div className="text-[11px] text-gray-400">{m.sessions_count} session{m.sessions_count !== 1 ? 's' : ''}</div>
      </div>

      {/* Status pill */}
      <div className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 ${badgeBg}`}>
        {active && (
          <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500 animate-[pulse_2s_ease-in-out_infinite]" />
        )}
        <span className={`text-[11px] font-semibold ${badgeColor}`}>{badgeLabel}</span>
      </div>
    </div>
  )
}
