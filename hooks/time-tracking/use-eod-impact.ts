'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { rpc } from '@/lib/rpc'
import { timeTrackingKeys } from './use-time-tracking-data'
import type { EodImpact } from '@/types/time-tracking'

/**
 * Real per-agent impact for the End-of-Day modal, scoped to the shift
 * SESSION being clocked out (clock-in → now), not the calendar day.
 * Only fetched while the caller is authenticated and a session id is known.
 */
export function useEodImpact(sessionId: string) {
  const token = useAuthStore((s) => s.session?.access_token ?? '')
  return useQuery<EodImpact>({
    queryKey: [...timeTrackingKeys.all, 'eod-impact', sessionId],
    queryFn: async () => rpc<EodImpact>('api_get_eod_impact', { p_session_id: sessionId }),
    enabled: !!token && !!sessionId,
    staleTime: 60_000,
  })
}
