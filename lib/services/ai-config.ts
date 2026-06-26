import { listStores } from '@/lib/services/stores'
import { getOnboardingStatus, getEnabledLessons, getExamples } from '@/lib/services/ai-onboarding'
import { buildEmmaSystemPrompt } from '@/lib/services/ai-prompt-builder'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { AiPolicies, AiScenario, AiLesson, AiExample } from '@/lib/services/ai-onboarding'

export interface AiSettings {
  storeId: string
  isComplete: boolean
  policies: AiPolicies | null
  scenarios: AiScenario[]
  lessons: AiLesson[]
  examples: AiExample[]
  systemPrompt: string | null
}

export async function resolveStoreId(workspaceId: string, storeId?: string): Promise<string> {
  const stores = await listStores(workspaceId)
  if (storeId) {
    // Validate an explicit storeId belongs to this workspace — prevents writing
    // an Emma row keyed to a store the workspace doesn't own.
    if (!stores.some((s) => s.id === storeId)) {
      throw new Error(`Store ${storeId} is not in this workspace.`)
    }
    return storeId
  }
  if (!stores.length) throw new Error('This workspace has no store to read Emma settings for.')
  const connected = stores.find((s) => s.shopify_connected_at != null)
  return (connected ?? stores[0]).id
}

export async function getAiSettings(workspaceId: string, storeId?: string): Promise<AiSettings> {
  const resolvedStoreId = await resolveStoreId(workspaceId, storeId)
  const [status, lessons, examples] = await Promise.all([
    getOnboardingStatus(resolvedStoreId, workspaceId),
    getEnabledLessons(resolvedStoreId, workspaceId),
    getExamples(resolvedStoreId, workspaceId),
  ])
  const systemPrompt = status.policies
    ? buildEmmaSystemPrompt(status.policies, status.scenarios, lessons, examples)
    : null
  return {
    storeId: resolvedStoreId,
    isComplete: status.isComplete,
    policies: status.policies,
    scenarios: status.scenarios,
    lessons,
    examples,
    systemPrompt,
  }
}

export type PoliciesPatch = Partial<AiPolicies>

export interface ScenarioPatch {
  title?: string | null
  approach?: string | null
  questions_to_ask?: string[] | null
  response_template?: string | null
  escalate_when?: string | null
  autonomy_pct?: number | null
  enabled?: boolean | null
}

export async function upsertPolicies(workspaceId: string, storeId: string | undefined, patch: PoliciesPatch): Promise<void> {
  const resolvedStoreId = await resolveStoreId(workspaceId, storeId)
  const existing = (await supabaseAdmin
    .from('ai_policies')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('store_id', resolvedStoreId)
    .maybeSingle()) as unknown as { data: Record<string, unknown> | null; error: { message: string } | null }

  if (existing.error) throw new Error(`upsertPolicies read failed: ${existing.error.message}`)

  if (existing.data) {
    const { error } = (await supabaseAdmin
      .from('ai_policies')
      .update(patch)
      .eq('workspace_id', workspaceId)
      .eq('store_id', resolvedStoreId)) as unknown as { error: { message: string } | null }

    if (error) throw new Error(`upsertPolicies update failed: ${error.message}`)
  } else {
    const { error } = await supabaseAdmin
      .from('ai_policies')
      .insert({ workspace_id: workspaceId, store_id: resolvedStoreId, ...patch })

    if (error) throw new Error(`upsertPolicies insert failed: ${error.message}`)
  }
}

export async function upsertScenario(
  workspaceId: string,
  storeId: string | undefined,
  scenarioKey: string,
  patch: ScenarioPatch
): Promise<void> {
  const resolvedStoreId = await resolveStoreId(workspaceId, storeId)
  const existing = (await supabaseAdmin
    .from('ai_scenarios')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('store_id', resolvedStoreId)
    .eq('scenario_key', scenarioKey)
    .maybeSingle()) as unknown as { data: Record<string, unknown> | null; error: { message: string } | null }

  if (existing.error) throw new Error(`upsertScenario read failed: ${existing.error.message}`)

  if (existing.data) {
    const { error } = (await supabaseAdmin
      .from('ai_scenarios')
      .update(patch)
      .eq('workspace_id', workspaceId)
      .eq('store_id', resolvedStoreId)
      .eq('scenario_key', scenarioKey)) as unknown as { error: { message: string } | null }

    if (error) throw new Error(`upsertScenario update failed: ${error.message}`)
  } else {
    const { error } = await supabaseAdmin
      .from('ai_scenarios')
      .insert({ workspace_id: workspaceId, store_id: resolvedStoreId, scenario_key: scenarioKey, ...patch })

    if (error) throw new Error(`upsertScenario insert failed: ${error.message}`)
  }
}
