'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { toast } from 'sonner'
import { aiAutonomyRulesKeys } from './use-ai-autonomy-rules-data'
import type { AiAutonomyRulesConfig } from '@/lib/schemas/ai'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export function useUpsertAiAutonomyRules(storeId: string) {
  const token = useToken()
  const queryClient = useQueryClient()

  return useMutation<AiAutonomyRulesConfig, Error, AiAutonomyRulesConfig>({
    mutationFn: async (config) => {
      const res = await fetch('/api/ai/autonomy-rules', {
        method:  'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ store_id: storeId, config }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? 'Failed to save')
      }
      const data = await res.json() as { config: AiAutonomyRulesConfig }
      return data.config
    },
    onSuccess: () => {
      toast.success('Saved')
      void queryClient.invalidateQueries({ queryKey: aiAutonomyRulesKeys.byStore(storeId) })
    },
    onError: (err) => toast.error(err.message),
  })
}
