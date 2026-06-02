'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { rpc } from '@/lib/rpc'
import { aiAutonomyRulesKeys } from './use-ai-autonomy-rules-data'
import type { AiAutonomyRulesConfig } from '@/lib/schemas/ai'

export function useUpsertAiAutonomyRules(storeId: string) {
  const queryClient = useQueryClient()

  return useMutation<AiAutonomyRulesConfig, Error, AiAutonomyRulesConfig>({
    mutationFn: async (config) => {
      const data = await rpc<{ config: AiAutonomyRulesConfig }>('api_upsert_ai_autonomy_rules', {
        p_store_id: storeId,
        p_config: config,
      })
      return data.config
    },
    onSuccess: () => {
      toast.success('Saved')
      void queryClient.invalidateQueries({ queryKey: aiAutonomyRulesKeys.byStore(storeId) })
    },
    onError: (err) => toast.error(err.message),
  })
}
