'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { AlertCircle, X } from 'lucide-react'
import { FILTERS, EMP_KPI, fmtDur } from '@/lib/time-tracking-constants'
import type { TimeFilter, Session, EodReport } from '@/types/time-tracking'
import { useAuthStore } from '@/stores/auth'
import {
  useClockIn,
  useClockOut,
  usePauseSession,
  useResumeSession,
  sendHeartbeat,
} from '@/hooks/time-tracking/use-time-tracking-mutations'
import { restoreElapsed } from '@/hooks/time-tracking/use-time-tracking-data'
import { FilterTabs } from './filter-tabs'
import { ClockCard } from './clock-card'
import { KpiCards } from './kpi-cards'
import { WorkLog } from './work-log'
import { ClockOutModal } from './clock-out-modal'

interface PersonalViewProps {
  isAdmin: boolean
  sessions: Session[]
  activeSession: Session | null
  todaySeconds: number
  filter: TimeFilter
  onFilterChange: (f: TimeFilter) => void
}

export function PersonalView({
  isAdmin,
  sessions,
  activeSession,
  todaySeconds,
  filter,
  onFilterChange,
}: PersonalViewProps) {
  const token = useAuthStore((s) => s.session?.access_token ?? '')

  // Local UI state for the timer
  const [elapsed, setElapsed] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [error, setError] = useState('')

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const breakTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [, setBreakTick] = useState(0)

  // TanStack mutations
  const clockIn = useClockIn()
  const clockOut = useClockOut()
  const pauseSession = usePauseSession()
  const resumeSession = useResumeSession()

  // Restore elapsed from active session when it changes
  useEffect(() => {
    if (activeSession) {
      setIsPaused(activeSession.status === 'paused')
      setElapsed(restoreElapsed(activeSession))
    } else {
      setElapsed(0)
      setIsPaused(false)
    }
  }, [activeSession?.id, activeSession])

  // Tick timer when active (not paused)
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (activeSession && !isPaused) {
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [activeSession?.id, isPaused]) // eslint-disable-line react-hooks/exhaustive-deps -- intentional: only re-run on session id change

  // Break timer tick for paused display
  useEffect(() => {
    if (breakTimerRef.current) clearInterval(breakTimerRef.current)
    if (activeSession && isPaused) {
      breakTimerRef.current = setInterval(() => setBreakTick((t) => t + 1), 1000)
    }
    return () => {
      if (breakTimerRef.current) clearInterval(breakTimerRef.current)
    }
  }, [activeSession?.id, isPaused]) // eslint-disable-line react-hooks/exhaustive-deps -- intentional: only re-run on session id change

  // Heartbeat every 30s when active
  useEffect(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    if (!activeSession || isPaused) return
    heartbeatRef.current = setInterval(() => {
      if (activeSession) {
        void sendHeartbeat(token, activeSession.id)
      }
    }, 30000)
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    }
  }, [activeSession?.id, isPaused, token]) // eslint-disable-line react-hooks/exhaustive-deps -- intentional: only re-run on session id change

  // Warn on page unload when session active
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!activeSession) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [activeSession])

  const handleClockIn = useCallback(() => {
    setError('')
    clockIn.mutate(undefined, {
      onError: (err) => {
        setError(
          err.message === 'Not a team member account'
            ? 'Your account is not set up for time tracking. Ask your admin to add you as a team member.'
            : err.message || 'Could not clock in. Please try again.'
        )
      },
    })
  }, [clockIn])

  const handlePause = useCallback(() => {
    if (!activeSession) return
    pauseSession.mutate(activeSession.id, {
      onSuccess: () => {
        if (timerRef.current) clearInterval(timerRef.current)
        if (heartbeatRef.current) clearInterval(heartbeatRef.current)
        setIsPaused(true)
      },
    })
  }, [activeSession, pauseSession])

  const handleResume = useCallback(() => {
    if (!activeSession) return
    resumeSession.mutate(activeSession.id, {
      onSuccess: () => {
        setIsPaused(false)
      },
    })
  }, [activeSession, resumeSession])

  const handleClockOut = useCallback(
    (report: EodReport) => {
      if (!activeSession) return
      clockOut.mutate(
        { sessionId: activeSession.id, report },
        {
          onSuccess: () => {
            setElapsed(0)
            setIsPaused(false)
            setShowModal(false)
          },
        }
      )
    },
    [activeSession, clockOut]
  )

  const pausedSec = (() => {
    if (!activeSession) return 0
    const base = activeSession.paused_seconds || 0
    if (isPaused && activeSession.paused_at) {
      // eslint-disable-next-line react-hooks/purity
      return base + Math.round((Date.now() - new Date(activeSession.paused_at).getTime()) / 1000)
    }
    return base
  })()

  const isActive = !!activeSession
  const filterLabel = FILTERS.find((f) => f.id === filter)?.label || 'This week'

  const totalPeriodSec = sessions.reduce((sum, s) => {
    if (!s.clocked_out_at) return sum
    const total = Math.round(
      (new Date(s.clocked_out_at).getTime() - new Date(s.clocked_in_at).getTime()) / 1000
    )
    return sum + Math.max(0, total - (s.paused_seconds || 0))
  }, 0)

  const empKpiCards = [
    {
      id: EMP_KPI[0].key,
      label: filterLabel.toUpperCase(),
      value: fmtDur(totalPeriodSec),
      sub: `${sessions.length} session${sessions.length !== 1 ? 's' : ''}`,
    },
    {
      id: EMP_KPI[1].key,
      label: EMP_KPI[1].label || 'TODAY',
      value: fmtDur(todaySeconds + (isActive ? elapsed : 0)),
      sub: 'Hours clocked today',
    },
    {
      id: EMP_KPI[2].key,
      label: EMP_KPI[2].label || 'AVG PER DAY',
      value: (() => {
        if (sessions.length === 0) return '\u2014'
        const days = filter === 'today' ? 1 : filter === 'week' ? 7 : new Date().getDate()
        return fmtDur(totalPeriodSec / Math.max(1, days))
      })(),
      sub: 'Daily average',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-up">
        <h1 className="mb-1 text-xl font-semibold tracking-tight text-foreground">Time Tracking</h1>
        <div className="mb-5 text-sm text-gray-500">Track your daily work hours</div>
        <FilterTabs filter={filter} onChange={onFilterChange} />
      </div>

      {/* Error toast */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-lg border border-red-600/15 bg-red-50 px-3.5 py-2.5 text-[13px] font-medium text-red-600 animate-fade-up">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button
            onClick={() => setError('')}
            className="ml-auto bg-transparent text-inherit opacity-60 text-base leading-none"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Clock card */}
      <ClockCard
        activeSession={activeSession}
        elapsed={elapsed}
        isPaused={isPaused}
        pausedSec={pausedSec}
        clockingIn={clockIn.isPending}
        isAdmin={isAdmin}
        sessions={sessions}
        onClockIn={handleClockIn}
        onPause={handlePause}
        onResume={handleResume}
        onClockOut={() => setShowModal(true)}
      />

      {/* KPI cards */}
      <KpiCards cards={empKpiCards} columns={3} />

      {/* Work log */}
      <WorkLog sessions={sessions} />

      {/* Clock out modal */}
      {showModal && activeSession && (
        <ClockOutModal
          session={activeSession}
          elapsedSec={elapsed}
          pausedSeconds={pausedSec}
          onConfirm={handleClockOut}
          onCancel={() => setShowModal(false)}
          submitting={clockOut.isPending}
        />
      )}
    </div>
  )
}
