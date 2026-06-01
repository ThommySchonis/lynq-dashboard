'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'

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

// Shape after the Emma onboarding refactor — `languages`, `can_decide`,
// `escalate_triggers` are gone; `*_options` + `*_notes` pairs replace
// them; tone_of_voice is the enum key; parcelpanel_url + cancellation_window
// are new. Fields stay optional so partial PATCH/PUT bodies type-check.
export interface AiPoliciesRow {
  id?: string
  store_id?: string
  workspace_id?: string
  brand_name?: string | null
  brand_description?: string | null
  tone_of_voice?: string | null
  sign_off?: string | null
  website_url?: string | null
  shipping_policy?: string | null
  refund_policy?: string | null
  customs_policy?: string | null
  can_decide_options?: string[]
  can_decide_notes?: string | null
  cannot_decide_options?: string[]
  cannot_decide_notes?: string | null
  parcelpanel_url?: string | null
  cancellation_window?: string | null
  tracking_url?: string | null
}

// Five-field scenario shape post-refactor — triggers / must_do /
// must_not_do are new; questions_to_ask + response_template stay on the
// type as legacy fields for backwards compatibility.
export interface AiScenarioRow {
  id?: string
  store_id?: string
  workspace_id?: string
  scenario_key?: string
  title?: string | null
  triggers?: string | null
  approach?: string | null
  must_do?: string | null
  must_not_do?: string | null
  escalate_when?: string | null
  questions_to_ask?: string[]
  response_template?: string | null
  autonomy_pct?: number
  enabled?: boolean
}

export function useAiPolicies(storeId: string) {
  const token = useToken()
  return useQuery<AiPoliciesRow | null>({
    queryKey: aiPolicyKeys.byStore(storeId),
    queryFn: async () => {
      const res = await fetch(`/api/ai/policies?store_id=${encodeURIComponent(storeId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load AI policies')
      const data = await res.json() as { policies?: AiPoliciesRow | null }
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
      const res = await fetch(`/api/ai/scenarios?store_id=${encodeURIComponent(storeId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load AI scenarios')
      const data = await res.json() as { scenarios?: AiScenarioRow[] }
      return data.scenarios ?? []
    },
    enabled: !!token && !!storeId,
  })
}
