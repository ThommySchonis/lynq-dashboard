'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { useStoreStore } from '@/stores/store'
import { rpc } from '@/lib/rpc'
import { supabase } from '@/lib/supabase'
import type { EmmaStats } from '@/types/ai-drafts'
import type { DateRange } from '@/types/analytics'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const EMPTY_EMMA_STATS: EmmaStats = {
  total_suggestions: 0,
  pending: 0,
  approved: 0,
  declined: 0,
  edited: 0,
  auto_sent: 0,
  regenerated: 0,
  total_resolved: 0,
  conversations_with_draft: 0,
  total_conversations: 0,
}

export const emmaStatsKeys = {
  all: ['emma-stats'] as const,
  stats: (storeId: string | null, from: string, to: string) =>
    [...emmaStatsKeys.all, storeId, from, to] as const,
  onboarded: (storeId: string | null) =>
    [...emmaStatsKeys.all, 'onboarded', storeId] as const,
}

export function useEmmaStats(range: DateRange) {
  const token = useToken()
  const activeStoreId = useStoreStore((s) => s.activeStoreId)
  return useQuery<EmmaStats>({
    queryKey: emmaStatsKeys.stats(activeStoreId, range.from, range.to),
    queryFn: async () => {
      const data = await rpc<EmmaStats>('api_get_emma_stats', {
        p_store_id: activeStoreId,
        p_from: range.from,
        p_to: range.to,
      })
      return data ?? EMPTY_EMMA_STATS
    },
    enabled: !!token && !!activeStoreId,
    staleTime: 5 * 60_000,
  })
}

export function useEmmaOnboarded() {
  const token = useToken()
  const activeStoreId = useStoreStore((s) => s.activeStoreId)
  return useQuery<boolean>({
    queryKey: emmaStatsKeys.onboarded(activeStoreId),
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_policies')
        .select('id')
        .eq('store_id', activeStoreId!)
        .limit(1)
        .maybeSingle()
      return !!data
    },
    enabled: !!token && !!activeStoreId,
    staleTime: 5 * 60_000,
  })
}
