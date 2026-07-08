'use client'

import { Play, Pause, Square, Loader2 } from 'lucide-react'
import { SHIFT_TARGET_SEC } from '@/lib/time-tracking-constants'
import type { TimeClock } from '@/hooks/time-tracking/use-time-clock'
import { TrackingPill } from './tracking-pill'

interface TimerControlsProps {
  clock: TimeClock
  /** Workspace's nominal shift length in seconds; falls back to the 8h default. */
  shiftTargetSec?: number
  /** Workspace suspended → all actions disabled. */
  disabled?: boolean
}

// Header timer affordances. Idle → a single green Start. Running → the
// TRACKING pill plus Pause/Resume and a solid-red Finish (opens the EOD
// modal). Mirrors the old ClockCard button logic, restyled to Figma.
export function TimerControls({ clock, shiftTargetSec, disabled = false }: TimerControlsProps) {
  const { isActive, isPaused, elapsed, clockingIn, clockIn, pause, resume, openModal } = clock
  const shiftTarget = shiftTargetSec && shiftTargetSec > 0 ? shiftTargetSec : SHIFT_TARGET_SEC

  if (!isActive) {
    return (
      <button
        onClick={clockIn}
        disabled={disabled || clockingIn}
        title={disabled ? 'Workspace is suspended' : undefined}
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-success pl-4 pr-[18px] text-sm font-semibold text-success-foreground transition-colors hover:bg-success/90 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {clockingIn ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
        {clockingIn ? 'Starting…' : 'Start'}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <TrackingPill elapsed={elapsed} progress={elapsed / shiftTarget} />
      <div className="flex items-center gap-2.5">
        <button
          onClick={openModal}
          disabled={disabled}
          title={disabled ? 'Workspace is suspended' : undefined}
          className="inline-flex h-11 w-[90px] shrink-0 items-center justify-center gap-2 rounded-lg bg-destructive text-sm font-semibold text-white transition-colors hover:bg-destructive-hover disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Square className="h-2.5 w-2.5 fill-current" />
          Finish
        </button>
        <button
          onClick={isPaused ? resume : pause}
          disabled={disabled}
          title={disabled ? 'Workspace is suspended' : undefined}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-border bg-card pl-4 pr-[18px] text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isPaused ? <Play className="h-3.5 w-3.5 fill-current" /> : <Pause className="h-3.5 w-3.5 fill-current" />}
          {isPaused ? 'Resume' : 'Pause'}
        </button>
      </div>
    </div>
  )
}
