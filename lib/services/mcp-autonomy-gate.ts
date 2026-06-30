import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resolveStoreIdForThread, getOnboardingStatus } from '@/lib/services/ai-onboarding'
import { shouldAutoSend, type AutoSendBlockedReason } from '@/lib/services/ai-autonomy'
import {
  aiAutonomyRulesConfig,
  DEFAULT_AUTONOMY_CONFIG,
  type AiAutonomyRulesConfig,
  type ReplyIntent,
} from '@/lib/schemas/ai'

/**
 * Read just the store-level auto-send toggle. Returns false on any miss.
 */
async function loadStoreAutoSendEnabled(storeId: string): Promise<boolean> {
  const { data: storeRow } = await supabaseAdmin
    .from('stores')
    .select('ai_auto_send_enabled')
    .eq('id', storeId)
    .single<{ ai_auto_send_enabled: boolean }>()
  return storeRow?.ai_auto_send_enabled ?? false
}

/**
 * Read the per-workspace/store autonomy rules row. Defaults to
 * DEFAULT_AUTONOMY_CONFIG on any miss or parse failure.
 */
async function loadAutonomyRules(
  workspaceId: string,
  storeId: string,
): Promise<AiAutonomyRulesConfig> {
  let rules: AiAutonomyRulesConfig = {
    master_enabled: DEFAULT_AUTONOMY_CONFIG.master_enabled,
    confidence_threshold: DEFAULT_AUTONOMY_CONFIG.confidence_threshold,
    global_block_intents: [...DEFAULT_AUTONOMY_CONFIG.global_block_intents],
  }
  const { data: rulesRow } = await supabaseAdmin
    .from('ai_autonomy_rules')
    .select('config')
    .eq('workspace_id', workspaceId)
    .eq('store_id', storeId)
    .maybeSingle<{ config: unknown }>()
  if (rulesRow?.config) {
    const parsed = aiAutonomyRulesConfig.safeParse(rulesRow.config)
    if (parsed.success) rules = parsed.data
  }
  return rules
}

/**
 * Load the per-store autonomy rules + the store-level auto-send toggle.
 * Defaults to the conservative DEFAULT_AUTONOMY_CONFIG on any miss or parse
 * failure. Mirrors the loads emma-generate.ts performs inline.
 * Kept exported because buildReplyContext (Task 5) needs both values together.
 */
export async function loadAutonomyConfig(
  workspaceId: string,
  storeId: string,
): Promise<{ rules: AiAutonomyRulesConfig; storeAutoSendEnabled: boolean }> {
  const [storeAutoSendEnabled, rules] = await Promise.all([
    loadStoreAutoSendEnabled(storeId),
    loadAutonomyRules(workspaceId, storeId),
  ])
  return { rules, storeAutoSendEnabled }
}

/**
 * Decide whether an MCP-composed reply may be sent NOW, applying the same
 * gate Emma's auto-send uses. Fail-safe: no resolvable store, or the store
 * toggle off, blocks with 'store_disabled'.
 */
export async function evaluateMcpSend(params: {
  workspaceId: string
  conversationId: string
  intent: ReplyIntent
  confidence: number
  shouldEscalate: boolean
}): Promise<{ allowed: boolean; reason: AutoSendBlockedReason | null; storeId: string | null }> {
  const { workspaceId, conversationId, intent, confidence, shouldEscalate } = params

  const storeId = await resolveStoreIdForThread(conversationId, workspaceId)
  if (!storeId) return { allowed: false, reason: 'store_disabled', storeId: null }

  const storeAutoSendEnabled = await loadStoreAutoSendEnabled(storeId)
  if (!storeAutoSendEnabled) return { allowed: false, reason: 'store_disabled', storeId }

  const rules = await loadAutonomyRules(workspaceId, storeId)
  const status = await getOnboardingStatus(storeId, workspaceId)
  const scenarioRow = status.scenarios.find((s) => s.scenario_key === intent) ?? null

  const decision = shouldAutoSend({
    draft: { intent, confidence, should_escalate: shouldEscalate },
    scenario: scenarioRow ? { autonomy_pct: scenarioRow.autonomy_pct } : null,
    rules,
  })

  return decision.send
    ? { allowed: true, reason: null, storeId }
    : { allowed: false, reason: decision.reason, storeId }
}
