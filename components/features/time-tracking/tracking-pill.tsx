'use client'

import { Clock } from 'lucide-react'
import { fmtElapsed } from '@/lib/time-tracking-constants'

interface TrackingPillProps {
  elapsed: number
  /** 0..1 — fraction of the nominal shift elapsed (drives the bottom bar). */
  progress: number
}

// Running-session badge shown in the page header: a "TRACKING" label, the
// live HH:MM:SS, and a thin progress bar pinned to the bottom edge.
export function TrackingPill({ elapsed, progress }: TrackingPillProps) {
  const pct = Math.max(0, Math.min(1, progress)) * 100

  return (
    <div className="relative flex h-11 w-[172px] items-center gap-[11px] overflow-hidden rounded-xl border border-success/30 bg-success-soft pt-[7px] pb-2 pl-[13px] pr-[15px]">
      <Clock className="h-4 w-4 shrink-0 text-success-strong" strokeWidth={2} />
      <div className="flex flex-col gap-px leading-none">
        <span className="text-[12px] font-medium leading-4 text-success-strong">TRACKING</span>
        <span className="text-[12px] font-bold tabular-nums text-foreground">{fmtElapsed(elapsed)}</span>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-success/10">
        <div className="h-full bg-success transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
