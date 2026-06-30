'use client'

import type { TimeClock } from '@/hooks/time-tracking/use-time-clock'
import { TimerControls } from './timer-controls'

interface TrackingHeaderProps {
  title: string
  subtitle: string
  clock: TimeClock
  /** Workspace suspended → timer actions disabled. */
  disabled?: boolean
}

// Page header: title + subtitle on the left, the personal timer/controls on
// the right. Shared by both the team (admin) and personal (employee) views —
// the timer always reflects the logged-in user's own session.
export function TrackingHeader({ title, subtitle, clock, disabled }: TrackingHeaderProps) {
  return (
    <div className="flex min-h-[54px] items-center justify-between gap-4 animate-fade-up">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-bold leading-[30px] tracking-[-0.01em] text-foreground">{title}</h1>
        <div className="text-sm text-foreground-3">{subtitle}</div>
      </div>
      <TimerControls clock={clock} disabled={disabled} />
    </div>
  )
}
