// lib/services/ai-onboarding.ts
//
// Emma Phase 1 — server-side onboarding gate for /api/ai/reply.
//
// Given a store, reports whether its AI agent onboarding is complete and
// returns the raw ai_policies row + ai_scenarios rows so a caller can build
// the Emma system prompt. The completeness rules MIRROR the UI completeness
// indicators in:
//   - components/features/settings/ai-agent/onboarding-settings.tsx
//     (fundamentComplete / policiesComplete / scenariosComplete)
//   - components/features/settings/ai-agent/scenarios-section.tsx (SCENARIOS)
// Keep the two in sync: what the user sees as ✓ is exactly what gates here.
//
// All reads go through supabaseAdmin (RLS bypass). Callers are expected to
// have verified the workspace context via getAuthContext before invoking.

import { supabaseAdmin } from '../supabaseAdmin'

export interface AiPolicies {
  brand_name: string | null
  brand_description: string | null
  tone_of_voice: string | null
  sign_off: string | null
  languages: string[] | null
  website_url: string | null
  shipping_policy: string | null
  refund_policy: string | null
  customs_policy: string | null
  can_decide: string[] | null
  cannot_decide: string[] | null
  escalate_triggers: string[] | null
  tracking_url: string | null
  // Phase 3 extension — design 2026-06-05
  industry: string | null
  product_categories: string[] | null
  formality_level: 'casual' | 'balanced' | 'formal' | null
  communication_style: string[] | null
  personality_preferences: string | null
  cancellation_policy: string | null
}

export interface AiScenario {
  scenario_key: string
  title: string | null
  approach: string | null
  questions_to_ask: string[] | null
  response_template: string | null
  escalate_when: string | null
  autonomy_pct: number | null
  enabled: boolean | null
}

export interface AiLesson {
  id: string
  lesson_text: string
  applies_to_scenario: string | null
  created_at: string
}

export interface AiExample {
  id: string
  example_text: string
  created_at: string
}

/**
 * Cap on examples injected into a single Emma prompt. Tighter than the
 * lessons cap because examples are long. Surfaced in the Examples UI
 * as "the 10 newest are used".
 */
export const EXAMPLE_PROMPT_LIMIT = 10

export interface OnboardingStatus {
  isComplete: boolean
  policies: AiPolicies | null
  scenarios: AiScenario[]
}

/**
 * Cap on lessons injected into a single Emma prompt. Surfaced in the
 * Lessons UI as "N of 50 active" so the user knows what the model
 * actually sees.
 */
export const LESSON_PROMPT_LIMIT = 50

// The 7 canonical scenarios, with the same human-readable titles the UI uses
// (components/features/settings/ai-agent/scenarios-section.tsx). The prompt
// builder reuses CANONICAL_SCENARIO_TITLES for scenario headings.
export const CANONICAL_SCENARIO_TITLES: Record<string, string> = {
  wismo:                'Where is my order?',
  long_delivery:        'Long delivery time',
  lost_package:         'Lost package',
  wrong_or_damaged:     'Wrong or damaged item',
  refund_or_cancel:     'Refund or cancellation',
  customs_fees:         'Customs fees',
  angry_or_chargeback:  'Angry customer or chargeback',
}

export const CANONICAL_SCENARIO_KEYS: string[] = Object.keys(CANONICAL_SCENARIO_TITLES)

const nonEmpty = (v: string | null | undefined): boolean => !!v && v.trim().length > 0
const nonEmptyList = (v: string[] | null | undefined): boolean => Array.isArray(v) && v.length > 0

/**
 * Resolve the store a conversation belongs to. `threadId` is the
 * email_conversations.id sent by the inbox AI Suggest action. Returns null
 * when the thread is unknown, has no store, or no threadId was supplied —
 * in all those cases the caller falls back to the legacy prompt path.
 */
export async function resolveStoreIdForThread(
  threadId: string | undefined,
  workspaceId: string
): Promise<string | null> {
  if (!threadId) return null
  const { data, error } = await supabaseAdmin
    .from('email_conversations')
    .select('store_id')
    .eq('id', threadId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (error) throw error
  return (data?.store_id as string | null) ?? null
}

/**
 * Read ai_policies + ai_scenarios for a store and evaluate onboarding
 * completeness. Two queries, run in parallel — no per-row fetch loops.
 *
 * Completeness rules (mirror the UI exactly):
 *  • Fundament — brand_name + industry + tone_of_voice + sign_off all non-empty.
 *  • Policies  — shipping_policy + refund_policy + cancellation_policy non-empty
 *                AND can_decide non-empty array AND escalate_triggers non-empty array.
 *  • Scenarios — every one of the 7 canonical scenario_keys has a row with
 *                non-empty approach AND non-empty escalate_when.
 */
export async function getOnboardingStatus(
  storeId: string,
  workspaceId: string
): Promise<OnboardingStatus> {
  const [policiesRes, scenariosRes] = await Promise.all([
    supabaseAdmin
      .from('ai_policies')
      .select(
        'brand_name, brand_description, tone_of_voice, sign_off, languages, website_url, ' +
          'shipping_policy, refund_policy, customs_policy, can_decide, cannot_decide, ' +
          'escalate_triggers, tracking_url, ' +
          'industry, product_categories, formality_level, communication_style, ' +
          'personality_preferences, cancellation_policy'
      )
      .eq('workspace_id', workspaceId)
      .eq('store_id', storeId)
      .maybeSingle(),
    supabaseAdmin
      .from('ai_scenarios')
      .select(
        'scenario_key, title, approach, questions_to_ask, response_template, ' +
          'escalate_when, autonomy_pct, enabled'
      )
      .eq('workspace_id', workspaceId)
      .eq('store_id', storeId),
  ])

  if (policiesRes.error) throw policiesRes.error
  if (scenariosRes.error) throw scenariosRes.error

  const policies = (policiesRes.data as unknown as AiPolicies | null) ?? null
  const scenarios = (scenariosRes.data as unknown as AiScenario[] | null) ?? []

  const fundamentComplete =
    nonEmpty(policies?.brand_name) &&
    nonEmpty(policies?.industry) &&
    nonEmpty(policies?.tone_of_voice) &&
    nonEmpty(policies?.sign_off)

  const policiesComplete =
    nonEmpty(policies?.shipping_policy) &&
    nonEmpty(policies?.refund_policy) &&
    nonEmpty(policies?.cancellation_policy) &&
    nonEmptyList(policies?.can_decide) &&
    nonEmptyList(policies?.escalate_triggers)

  const byKey = new Map(scenarios.map((s) => [s.scenario_key, s]))
  const scenariosComplete = CANONICAL_SCENARIO_KEYS.every((key) => {
    const row = byKey.get(key)
    return nonEmpty(row?.approach) && nonEmpty(row?.escalate_when)
  })

  return {
    isComplete: !!policies && fundamentComplete && policiesComplete && scenariosComplete,
    policies,
    scenarios,
  }
}

/**
 * Read enabled lessons for a store, newest first, capped at `limit`.
 * Used by the Emma prompt builder via /api/ai/reply. Single indexed
 * query (idx_ai_lessons_store from 20260530000000_ai_agent_tables.sql
 * covers the store_id predicate; workspace_id + enabled stay in the
 * filter for defense-in-depth).
 *
 * Throws on DB error — callers are expected to wrap in try/catch and
 * fall back to an empty array so AI Suggest never 500s because of a
 * lessons read. Mirrors getOnboardingStatus's "throw, caller decides"
 * contract.
 */
export async function getEnabledLessons(
  storeId: string,
  workspaceId: string,
  limit: number = LESSON_PROMPT_LIMIT
): Promise<AiLesson[]> {
  const { data, error } = await supabaseAdmin
    .from('ai_lessons')
    .select('id, lesson_text, applies_to_scenario, created_at')
    .eq('workspace_id', workspaceId)
    .eq('store_id', storeId)
    .eq('enabled', true)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data as unknown as AiLesson[] | null) ?? []
}

/**
 * Read examples for a store, newest first, capped at `limit`. Used by
 * the Emma prompt builder via /api/ai/reply. Single indexed query
 * (idx_ai_examples_store covers the store_id predicate).
 *
 * Throws on DB error — callers wrap in try/catch and fall back to an
 * empty array so AI Suggest never 500s because of an examples read.
 * Mirrors getEnabledLessons's "throw, caller decides" contract.
 */
export async function getExamples(
  storeId: string,
  workspaceId: string,
  limit: number = EXAMPLE_PROMPT_LIMIT,
): Promise<AiExample[]> {
  const { data, error } = await supabaseAdmin
    .from('ai_examples')
    .select('id, example_text, created_at')
    .eq('workspace_id', workspaceId)
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data as unknown as AiExample[] | null) ?? []
}
