'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { rpc } from '@/lib/rpc'
import type { TimeFilter, Session, TeamMember } from '@/types/time-tracking'

export function restoreElapsed(s: Session | null): number {
  if (!s) return 0
  const total = Math.round((Date.now() - new Date(s.clocked_in_at).getTime()) / 1000)
  const paused = s.paused_seconds || 0
  if (s.status === 'paused' && s.paused_at) {
    const atPause = Math.round((new Date(s.paused_at).getTime() - new Date(s.clocked_in_at).getTime()) / 1000)
    return Math.max(0, atPause - paused)
  }
  return Math.max(0, total - paused)
}

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const timeTrackingKeys = {
  all: ['time-tracking'] as const,
  time: (filter: TimeFilter) => [...timeTrackingKeys.all, 'time', filter] as const,
}

export interface TimeDataResponse {
  is_admin?: boolean
  is_client_admin?: boolean
  member?: TeamMember
  sessions?: Session[]
  today_seconds?: number
  active_session?: Session | null
  members?: TeamMember[]
  active_count?: number
  paused_count?: number
  client?: { company_name: string }
  /** Workspace's nominal shift length; scales the header progress bar. */
  shift_target_seconds?: number
}

export function useTimeData(filter: TimeFilter) {
  const token = useToken()
  return useQuery<TimeDataResponse>({
    queryKey: timeTrackingKeys.time(filter),
    queryFn: async () => {
      return rpc<TimeDataResponse>('api_list_time_sessions', { p_filter: filter })
    },
    enabled: !!token,
  })
}

export function useActiveSession(filter: TimeFilter) {
  const token = useToken()
  return useQuery<Session | null>({
    queryKey: [...timeTrackingKeys.time(filter), 'active-session'],
    queryFn: async () => {
      const d = await rpc<TimeDataResponse>('api_list_time_sessions', { p_filter: filter })
      return d.active_session ?? null
    },
    enabled: !!token,
    refetchInterval: 30000,
  })
}
