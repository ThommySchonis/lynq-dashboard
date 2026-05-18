'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { timeTrackingKeys } from './use-time-tracking-data'
import { parseJson } from '@/lib/utils/typed-json'
import type { EodReport } from '@/types/time-tracking'

interface ErrorResponse {
  error?: string
}

interface ResumeSessionResponse {
  paused_seconds: number
}

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export function useClockIn() {
  const token = useToken()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'clock-in' }),
      })
      if (!res.ok) throw new Error('Failed to clock in')
      return parseJson<unknown>(res)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: timeTrackingKeys.all })
    },
  })
}

export function useClockOut() {
  const token = useToken()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ sessionId, report }: { sessionId: string; report: EodReport }) => {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action:     'clock-out',
          session_id: sessionId,
          report: {
            emails_answered: report.emailsAnswered,
            what_went_well:  report.whatWentWell,
            needs_attention: report.needsAttention,
          },
        }),
      })
      if (!res.ok) {
        const err = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(err.error || 'Failed to clock out')
      }
      return parseJson<unknown>(res)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: timeTrackingKeys.all })
    },
  })
}

export function usePauseSession() {
  const token = useToken()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'pause', session_id: sessionId }),
      })
      if (!res.ok) throw new Error('Failed to pause session')
      return parseJson<unknown>(res)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: timeTrackingKeys.all })
    },
  })
}

export function useResumeSession() {
  const token = useToken()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'resume', session_id: sessionId }),
      })
      if (!res.ok) throw new Error('Failed to resume session')
      const d = await parseJson<ResumeSessionResponse>(res)
      return d
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: timeTrackingKeys.all })
    },
  })
}

interface EditSessionPatch {
  clocked_in_at?:  string
  clocked_out_at?: string | null
  emails_answered?: number | null
  what_went_well?:  string | null
  needs_attention?: string | null
  reason:          string
}

export function useEditSession() {
  const token = useToken()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ sessionId, patch }: { sessionId: string; patch: EditSessionPatch }) => {
      const res = await fetch(`/api/time/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const err = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(err.error || 'Failed to update session')
      }
      return parseJson<unknown>(res)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: timeTrackingKeys.all })
    },
  })
}

export async function sendHeartbeat(token: string, sessionId: string): Promise<void> {
  await fetch('/api/time', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action: 'heartbeat', session_id: sessionId }),
  })
}
