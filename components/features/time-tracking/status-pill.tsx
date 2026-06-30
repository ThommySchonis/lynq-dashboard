'use client'

import type { Session } from '@/types/time-tracking'

const STYLES = {
  active:    { box: 'bg-accent-soft',  text: 'text-primary', dot: 'bg-primary' },
  paused:    { box: 'bg-warning-soft',  text: 'text-warning', dot: 'bg-warning' },
  completed: { box: 'bg-success-soft',  text: 'text-success', dot: 'bg-success' },
} as const

function statusOf(s: Session): { key: keyof typeof STYLES; label: string } {
  if (!s.clocked_out_at && s.status === 'paused') return { key: 'paused', label: 'On break' }
  if (!s.clocked_out_at) return { key: 'active', label: 'Active' }
  return { key: 'completed', label: 'Completed' }
}

// Session status chip — derived from clock-out + pause state. Shared by the
// admin sessions table and the personal work log.
export function StatusPill({ session }: { session: Session }) {
  const { key, label } = statusOf(session)
  const s = STYLES[key]
  return (
    <span className={`inline-flex items-center gap-[5px] rounded-full px-[9px] py-1 ${s.box}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} />
      <span className={`text-xs font-semibold ${s.text}`}>{label}</span>
    </span>
  )
}
