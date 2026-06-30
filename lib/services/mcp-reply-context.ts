import type { MacroSummary } from '@/lib/services/macros'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getConversation, type ConversationDetail } from '@/lib/services/conversations'
import { getAiSettings, type AiSettings } from '@/lib/services/ai-config'
import { listMacros } from '@/lib/services/macros'
import { lookupCustomerForWorkspace } from '@/lib/services/mcp-shopify'
import { loadAutonomyConfig } from '@/lib/services/mcp-autonomy-gate'
import { REPLY_INTENTS } from '@/lib/schemas/ai'

export type RankedMacro = MacroSummary & { score: number }

// Lowercased word tokens of length >= 3. Text is capped so a huge
// thread can't blow up the comparison.
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .slice(0, 4000)
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((w) => w.length >= 3)
  )
}

/**
 * Rank macros by relevance to a conversation. +2 for a language match,
 * +1 per overlapping keyword between the conversation text and the macro's
 * name + tags + body. Stable sort, score-descending. Never filters anything
 * out — callers slice the top N.
 */
export function rankMacros(
  macros: MacroSummary[],
  opts: { language?: string; text: string },
): RankedMacro[] {
  const words = tokenize(opts.text)
  return macros
    .map((m) => {
      let score = 0
      if (opts.language && m.language === opts.language) score += 2
      const hay = tokenize(`${m.name} ${m.tags.join(' ')} ${m.body}`)
      for (const w of words) if (hay.has(w)) score += 1
      return { ...m, score }
    })
    .sort((a, b) => b.score - a.score)
}

// ---------------------------------------------------------------------------
// buildReplyContext — grounding bundle for the get_reply_context MCP tool
// ---------------------------------------------------------------------------

export interface ReplyContextAutonomy {
  master_enabled: boolean
  confidence_threshold: number
  global_block_intents: string[]
  store_auto_send_enabled: boolean
  perScenarioAutonomyPct: Record<string, number>
}

export interface ReplyContext {
  thread: ConversationDetail
  order: unknown
  aiSettings: AiSettings
  suggestedMacros: RankedMacro[]
  autonomy: ReplyContextAutonomy
  validIntents: string[]
  guidance: string
}

const GUIDANCE =
  'Compose the reply grounded in aiSettings.systemPrompt and, when one fits, the top suggestedMacros entry. ' +
  'Then call send_reply with the chosen intent and your confidence (0-1). The server enforces the workspace ' +
  'autonomy rules: if the reply may not auto-send, it is saved as a draft for human review (the response says why). ' +
  'Use create_draft when a human should review regardless. Use list_members to find a member id for assignment.'

function latestCustomerText(thread: ConversationDetail): string {
  const msgs = thread.messages ?? []
  const lastInbound = [...msgs].reverse().find((m) => !m.is_outbound)
  const chosen = lastInbound ?? msgs[msgs.length - 1]
  return chosen?.body_text ?? thread.subject ?? ''
}

export async function buildReplyContext(params: {
  workspaceId: string
  conversationId: string
  storeId?: string
}): Promise<ReplyContext | null> {
  const { workspaceId, conversationId, storeId } = params

  const thread = await getConversation(supabaseAdmin as never, workspaceId, conversationId)
  if (!thread) return null

  const aiSettings = await getAiSettings(workspaceId, storeId)

  const macros = await listMacros(supabaseAdmin as never, workspaceId, {})
  const language =
    (aiSettings.policies?.languages && aiSettings.policies.languages[0]) || undefined
  const suggestedMacros = rankMacros(macros, { language, text: latestCustomerText(thread) }).slice(0, 5)

  let order: unknown = null
  if (thread.customer_email) {
    try {
      order = await lookupCustomerForWorkspace(workspaceId, { email: thread.customer_email }, { storeId: aiSettings.storeId })
    } catch {
      order = null
    }
  }

  const { rules, storeAutoSendEnabled } = await loadAutonomyConfig(workspaceId, aiSettings.storeId)
  const perScenarioAutonomyPct: Record<string, number> = {}
  for (const s of aiSettings.scenarios) {
    perScenarioAutonomyPct[s.scenario_key] = s.autonomy_pct ?? 0
  }

  return {
    thread,
    order,
    aiSettings,
    suggestedMacros,
    autonomy: {
      master_enabled: rules.master_enabled,
      confidence_threshold: rules.confidence_threshold,
      global_block_intents: rules.global_block_intents,
      store_auto_send_enabled: storeAutoSendEnabled,
      perScenarioAutonomyPct,
    },
    validIntents: [...REPLY_INTENTS],
    guidance: GUIDANCE,
  }
}
