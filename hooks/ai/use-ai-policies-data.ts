'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { rpc } from '@/lib/rpc'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const aiPolicyKeys = {
  all:       ['ai-policies'] as const,
  byStore:   (storeId: string) => [...aiPolicyKeys.all, storeId] as const,
}

export const aiScenarioKeys = {
  all:       ['ai-scenarios'] as const,
  byStore:   (storeId: string) => [...aiScenarioKeys.all, storeId] as const,
}

export interface AiPoliciesRow {
  id?: string
  store_id?: string
  workspace_id?: string
  brand_name?: string | null
  brand_description?: string | null
  tone_of_voice?: string | null
  sign_off?: string | null
  languages?: string[]
  website_url?: string | null
  shipping_policy?: string | null
  refund_policy?: string | null
  customs_policy?: string | null
  can_decide?: string[]
  cannot_decide?: string[]
  escalate_triggers?: string[]
  tracking_url?: string | null
  // Phase 3 extension — design 2026-06-05
  industry?: string | null
  product_categories?: string[]
  formality_level?: 'casual' | 'balanced' | 'formal' | null
  communication_style?: string[]
  personality_preferences?: string | null
  cancellation_policy?: string | null
}

export interface AiScenarioRow {
  id?: string
  store_id?: string
  workspace_id?: string
  scenario_key?: string
  title?: string | null
  approach?: string | null
  questions_to_ask?: string[]
  response_template?: string | null
  escalate_when?: string | null
  autonomy_pct?: number
  enabled?: boolean
}

export function useAiPolicies(storeId: string) {
  const token = useToken()
  return useQuery<AiPoliciesRow | null>({
    queryKey: aiPolicyKeys.byStore(storeId),
    queryFn: async () => {
      const data = await rpc<{ policies: AiPoliciesRow | null }>('api_get_ai_policies', { p_store_id: storeId })
      return data.policies ?? null
    },
    enabled: !!token && !!storeId,
  })
}

export function useAiScenarios(storeId: string) {
  const token = useToken()
  return useQuery<AiScenarioRow[]>({
    queryKey: aiScenarioKeys.byStore(storeId),
    queryFn: async () => {
      const data = await rpc<{ scenarios: AiScenarioRow[] }>('api_list_ai_scenarios', { p_store_id: storeId })
      return data.scenarios ?? []
    },
    enabled: !!token && !!storeId,
  })
}
