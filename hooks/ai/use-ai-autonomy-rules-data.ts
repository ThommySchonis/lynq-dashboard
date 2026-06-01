'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import type { AiAutonomyRulesConfig } from '@/lib/schemas/ai'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const aiAutonomyRulesKeys = {
  all:     ['ai-autonomy-rules'] as const,
  byStore: (storeId: string) => [...aiAutonomyRulesKeys.all, storeId] as const,
}

export interface AiAutonomyRulesResponse {
  config:               AiAutonomyRulesConfig
  has_persisted_config: boolean
}

export function useAiAutonomyRules(storeId: string) {
  const token = useToken()
  return useQuery<AiAutonomyRulesResponse>({
    queryKey: aiAutonomyRulesKeys.byStore(storeId),
    queryFn: async () => {
      const res = await fetch(
        `/api/ai/autonomy-rules?store_id=${encodeURIComponent(storeId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!res.ok) throw new Error('Failed to load autonomy rules')
      const data = await res.json() as AiAutonomyRulesResponse
      return data
    },
    enabled: !!token && !!storeId,
  })
}
