'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { rpc } from '@/lib/rpc'
import { aiPolicyKeys, aiScenarioKeys } from './use-ai-policies-data'
import type { AiPoliciesRow, AiScenarioRow } from './use-ai-policies-data'

export function useUpsertAiPolicies(storeId: string) {
  const queryClient = useQueryClient()

  return useMutation<AiPoliciesRow, Error, Omit<AiPoliciesRow, 'id' | 'workspace_id'>>({
    mutationFn: async (body) => {
      const data = await rpc<{ policies: AiPoliciesRow }>('api_upsert_ai_policies', {
        p_store_id: storeId,
        p_brand_name: body.brand_name ?? null,
        p_brand_description: body.brand_description ?? null,
        p_tone_of_voice: body.tone_of_voice ?? null,
        p_sign_off: body.sign_off ?? null,
        p_languages: body.languages ?? null,
        p_website_url: body.website_url ?? null,
        p_shipping_policy: body.shipping_policy ?? null,
        p_refund_policy: body.refund_policy ?? null,
        p_customs_policy: body.customs_policy ?? null,
        p_can_decide: body.can_decide ?? null,
        p_cannot_decide: body.cannot_decide ?? null,
        p_escalate_triggers: body.escalate_triggers ?? null,
        p_tracking_url: body.tracking_url ?? null,
        p_industry: body.industry ?? null,
        p_product_categories: body.product_categories ?? null,
        p_formality_level: body.formality_level ?? null,
        p_communication_style: body.communication_style ?? null,
        p_personality_preferences: body.personality_preferences ?? null,
        p_cancellation_policy: body.cancellation_policy ?? null,
      })
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
  const queryClient = useQueryClient()

  return useMutation<AiScenarioRow, Error, Omit<AiScenarioRow, 'id' | 'workspace_id'>>({
    mutationFn: async (body) => {
      const data = await rpc<{ scenario: AiScenarioRow }>('api_upsert_ai_scenario', {
        p_store_id: storeId,
        p_scenario_key: body.scenario_key ?? '',
        p_title: body.title ?? null,
        p_approach: body.approach ?? null,
        p_questions_to_ask: body.questions_to_ask ?? null,
        p_response_template: body.response_template ?? null,
        p_escalate_when: body.escalate_when ?? null,
        p_autonomy_pct: body.autonomy_pct ?? null,
        p_enabled: body.enabled ?? null,
      })
      return data.scenario
    },
    onSuccess: () => {
      toast.success('Saved')
      void queryClient.invalidateQueries({ queryKey: aiScenarioKeys.byStore(storeId) })
    },
    onError: (err) => toast.error(err.message),
  })
}
