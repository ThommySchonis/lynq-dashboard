'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { timeTrackingKeys } from './use-time-tracking-data'
import { rpc } from '@/lib/rpc'
import type { EodReport } from '@/types/time-tracking'

interface EditSessionPatch {
  clocked_in_at?:  string
  clocked_out_at?: string | null
  what_went_well?:  string | null
  needs_attention?: string | null
  mood?:           string | null
  reason:          string
}

export function useClockIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      return rpc('api_time_clock_in')
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: timeTrackingKeys.all })
    },
  })
}

export function useClockOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sessionId, report }: { sessionId: string; report: EodReport }) => {
      return rpc('api_time_clock_out', {
        p_session_id: sessionId,
        p_what_went_well: report.whatWentWell ?? null,
        p_needs_attention: report.needsAttention ?? null,
        p_mood: report.mood ?? null,
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: timeTrackingKeys.all })
    },
  })
}

export function usePauseSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sessionId: string) => {
      return rpc('api_time_pause', { p_session_id: sessionId })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: timeTrackingKeys.all })
    },
  })
}

export function useResumeSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sessionId: string) => {
      return rpc<{ ok: boolean; paused_seconds: number }>('api_time_resume', { p_session_id: sessionId })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: timeTrackingKeys.all })
    },
  })
}

export function useEditSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sessionId, patch }: { sessionId: string; patch: EditSessionPatch }) => {
      return rpc('api_edit_time_session', {
        p_session_id: sessionId,
        p_clocked_in_at: patch.clocked_in_at ?? null,
        p_clocked_out_at: patch.clocked_out_at ?? null,
        p_what_went_well: patch.what_went_well ?? null,
        p_needs_attention: patch.needs_attention ?? null,
        p_mood: patch.mood ?? null,
        p_reason: patch.reason ?? null,
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: timeTrackingKeys.all })
    },
  })
}

export async function sendHeartbeat(_token: string, sessionId: string): Promise<void> {
  await rpc('api_time_heartbeat', { p_session_id: sessionId })
}
