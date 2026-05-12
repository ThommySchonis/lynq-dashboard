'use client'

import { Play, Pause, Square, Loader2 } from 'lucide-react'
import { fmtElapsed, fmtTime, fmtDur, durSec, fmtDate } from '@/lib/time-tracking-constants'
import type { Session } from '@/types/time-tracking'

interface ClockCardProps {
  activeSession: Session | null
  elapsed: number
  isPaused: boolean
  pausedSec: number
  clockingIn: boolean
  isAdmin: boolean
  sessions: Session[]
  onClockIn: () => void
  onPause: () => void
  onResume: () => void
  onClockOut: () => void
}

export function ClockCard({
  activeSession,
  elapsed,
  isPaused,
  pausedSec,
  clockingIn,
  isAdmin,
  sessions,
  onClockIn,
  onPause,
  onResume,
  onClockOut,
}: ClockCardProps) {
  const isActive = !!activeSession

  return (
    <div className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-black/7 bg-white p-6 opacity-0 animate-fade-up delay-[50ms]">
      <div>
        {isActive ? (
          <>
            <div className={`mb-2.5 text-[10px] font-bold uppercase tracking-widest ${isPaused ? 'text-amber-500' : 'text-gray-400'}`}>
              {isPaused ? 'Paused' : 'Working'}
            </div>
            <div className={`mb-2 flex items-center gap-2.5 ${isPaused ? 'animate-[pauseBlink_2s_ease-in-out_infinite]' : ''}`}>
              {!isPaused && (
                <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 animate-[pulse_2s_ease-in-out_infinite]" />
              )}
              {isPaused && (
                <div className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
              )}
              <div className="text-[22px] font-bold tracking-tight text-foreground tabular-nums">
                {isPaused ? 'Paused' : 'Clocked in'} &middot; {fmtElapsed(elapsed)}
              </div>
            </div>
            <div className="flex gap-3 text-xs text-gray-500">
              <span>Started {fmtTime(activeSession.clocked_in_at)}</span>
              {pausedSec > 0 && <span className="text-amber-600">Break {fmtDur(pausedSec)}</span>}
            </div>
          </>
        ) : (
          <>
            <div className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Not clocked in
            </div>
            <div className="mb-2 text-[22px] font-bold tracking-tight text-foreground">
              Ready to start
            </div>
            {sessions.length > 0 && sessions[0]?.clocked_out_at && (
              <div className="text-xs text-gray-500">
                Last session: {fmtDate(sessions[0].clocked_in_at)} &middot; {fmtDur(durSec(sessions[0]))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {!isActive && (
          <button
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-[#0F0F10] px-5 text-[13px] font-semibold text-white transition-all hover:bg-[#1a1a1a] disabled:opacity-45 disabled:cursor-not-allowed"
            onClick={onClockIn}
            disabled={clockingIn || isAdmin}
            title={isAdmin ? 'Admin accounts cannot clock in' : undefined}
          >
            {clockingIn ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
            {clockingIn ? 'Starting...' : 'Clock In'}
          </button>
        )}
        {isActive && !isPaused && (
          <>
            <button
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-black/8 bg-gray-100 px-5 text-[13px] font-semibold text-gray-700 transition-all hover:bg-gray-200"
              onClick={onPause}
            >
              <Pause className="h-[13px] w-[13px] fill-current" />
              Pause
            </button>
            <button
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-red-500 px-5 text-[13px] font-semibold text-white transition-all hover:bg-red-600"
              onClick={onClockOut}
            >
              <Square className="h-[13px] w-[13px] fill-current" />
              Clock Out
            </button>
          </>
        )}
        {isActive && isPaused && (
          <>
            <button
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-black/8 bg-gray-100 px-5 text-[13px] font-semibold text-gray-700 transition-all hover:bg-gray-200"
              onClick={onResume}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Resume
            </button>
            <button
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-red-500 px-5 text-[13px] font-semibold text-white transition-all hover:bg-red-600"
              onClick={onClockOut}
            >
              <Square className="h-[13px] w-[13px] fill-current" />
              Clock Out
            </button>
          </>
        )}
      </div>
    </div>
  )
}
