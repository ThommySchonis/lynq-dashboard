'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth'
import {
  useClockIn,
  useClockOut,
  usePauseSession,
  useResumeSession,
  sendHeartbeat,
} from './use-time-tracking-mutations'
import { restoreElapsed } from './use-time-tracking-data'
import type { Session, EodReport } from '@/types/time-tracking'

export interface TimeClock {
  /** Seconds elapsed on the active session (live-ticking when running). */
  elapsed: number
  isPaused: boolean
  /** Accumulated break seconds, including the in-progress pause. */
  pausedSec: number
  isActive: boolean
  /** Last clock-in error message, '' when none. */
  error: string
  clearError: () => void
  /** EOD-modal visibility (opened by the clock-out affordance). */
  showModal: boolean
  openModal: () => void
  closeModal: () => void
  clockingIn: boolean
  submitting: boolean
  clockIn: () => void
  pause: () => void
  resume: () => void
  clockOut: (report: EodReport) => void
}

/**
 * Owns the live timer for a single tracking session: elapsed/break ticking,
 * 30s heartbeat, page-unload guard, and the clock-in/pause/resume/clock-out
 * mutations. Extracted verbatim from PersonalView so the page header and any
 * view can share one clock. Pure plumbing — no rendering.
 */
export function useTimeClock(activeSession: Session | null): TimeClock {
  const token = useAuthStore((s) => s.session?.access_token ?? '')

  const [elapsed, setElapsed] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [error, setError] = useState('')

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const breakTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [, setBreakTick] = useState(0)

  const clockInMut = useClockIn()
  const clockOutMut = useClockOut()
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

  const clockIn = useCallback(() => {
    setError('')
    clockInMut.mutate(undefined, {
      onError: (err) => {
        setError(
          err.message === 'Not a team member account'
            ? 'Your account is not set up for time tracking. Ask your admin to add you as a team member.'
            : err.message || 'Could not clock in. Please try again.'
        )
      },
    })
  }, [clockInMut])

  const pause = useCallback(() => {
    if (!activeSession) return
    pauseSession.mutate(activeSession.id, {
      onSuccess: () => {
        if (timerRef.current) clearInterval(timerRef.current)
        if (heartbeatRef.current) clearInterval(heartbeatRef.current)
        setIsPaused(true)
      },
    })
  }, [activeSession, pauseSession])

  const resume = useCallback(() => {
    if (!activeSession) return
    resumeSession.mutate(activeSession.id, {
      onSuccess: () => {
        setIsPaused(false)
      },
    })
  }, [activeSession, resumeSession])

  const clockOut = useCallback(
    (report: EodReport) => {
      if (!activeSession) return
      clockOutMut.mutate(
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
    [activeSession, clockOutMut]
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

  const clearError = useCallback(() => setError(''), [])
  const openModal = useCallback(() => setShowModal(true), [])
  const closeModal = useCallback(() => setShowModal(false), [])

  return {
    elapsed,
    isPaused,
    pausedSec,
    isActive: !!activeSession,
    error,
    clearError,
    showModal,
    openModal,
    closeModal,
    clockingIn: clockInMut.isPending,
    submitting: clockOutMut.isPending,
    clockIn,
    pause,
    resume,
    clockOut,
  }
}
