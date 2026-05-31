'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { toast } from 'sonner'
import { aiPolicyKeys, aiScenarioKeys } from './use-ai-policies-data'
import type { AiPoliciesRow, AiScenarioRow } from './use-ai-policies-data'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export function useUpsertAiPolicies(storeId: string) {
  const token = useToken()
  const queryClient = useQueryClient()

  return useMutation<AiPoliciesRow, Error, Omit<AiPoliciesRow, 'id' | 'workspace_id'>>({
    mutationFn: async (body) => {
      const res = await fetch('/api/ai/policies', {
        method:  'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...body, store_id: storeId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? 'Failed to save')
      }
      const data = await res.json() as { policies: AiPoliciesRow }
      return data.policies
    },
    onSuccess: () => {
      toast.success('Saved')
      void queryClient.invalidateQueries({ queryKey: aiPolicyKeys.byStore(storeId) })
    },
    onError: (err) => toast.error(err.message),
  })
}

export function useUpsertAiScenario(storeId: string) {
  const token = useToken()
  const queryClient = useQueryClient()

  return useMutation<AiScenarioRow, Error, Omit<AiScenarioRow, 'id' | 'workspace_id'>>({
    mutationFn: async (body) => {
      const res = await fetch('/api/ai/scenarios', {
        method:  'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...body, store_id: storeId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? 'Failed to save')
      }
      const data = await res.json() as { scenario: AiScenarioRow }
      return data.scenario
    },
    onSuccess: () => {
      toast.success('Saved')
      void queryClient.invalidateQueries({ queryKey: aiScenarioKeys.byStore(storeId) })
    },
    onError: (err) => toast.error(err.message),
  })
}
