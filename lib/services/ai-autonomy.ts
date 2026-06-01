// lib/services/ai-autonomy.ts
//
// Emma Phase 2 — pure decision logic for the gated auto-send.
//
// shouldAutoSend() takes the just-produced structured draft, the scenario
// row matching the draft's intent (when available), and the per-store
// autonomy rules, and returns whether Emma may auto-send or — if blocked —
// the structured reason matching the auto_send_blocked_reason CHECK
// constraint on ai_drafts (20260602000000_ai_drafts_autosend.sql).
//
// No DB access, no side effects, no I/O. Same pure-helper convention as
// lib/services/ai-prompt-builder.ts: caller loads the inputs, this file
// makes the call.

import type { AiAutonomyRulesConfig, ReplyIntent } from '@/lib/schemas/ai'

export type AutoSendBlockedReason =
  | 'master_off'
  | 'blocked_intent'
  | 'scenario_locked'
  | 'emma_escalate'
  | 'confidence_low'
  // 'send_failed' is set by the executor after a successful decision,
  // never returned by shouldAutoSend itself. Kept here for the type
  // that the route persists onto ai_drafts.
  | 'send_failed'

export type ShouldAutoSendResult =
  | { send: true }
  | { send: false; reason: Exclude<AutoSendBlockedReason, 'send_failed'> }

interface DraftInput {
  intent:          ReplyIntent
  confidence:      number
  should_escalate: boolean
}

interface ScenarioInput {
  autonomy_pct: number | null
}

interface Inputs {
  draft:    DraftInput
  // null when the draft's intent is 'other' or 'unknown' (no matching
  // scenario row) or when the store has no row for this scenario_key yet.
  scenario: ScenarioInput | null
  rules:    AiAutonomyRulesConfig
}

/**
 * Decide whether Emma may auto-send the just-produced draft.
 *
 * Branch order (first match wins):
 *   1. master_off         — the workspace switch is off.
 *   2. blocked_intent     — the draft's intent is on the store's global block list.
 *   3. scenario_locked    — the matching scenario row has autonomy_pct === 0
 *                           (used for chargeback / angry — always human).
 *   4. emma_escalate      — Emma's own structured output flagged escalation
 *                           (chargeback signal, low confidence, escalate trigger
 *                           hit — Emma decides; we trust it).
 *   5. confidence_low     — draft.confidence < max(store threshold,
 *                           per-scenario autonomy/100). The Math.max keeps
 *                           "more conservative wins" semantics: a low store
 *                           threshold can't override a high scenario threshold.
 *
 * If none of the blocks fire → { send: true }.
 */
export function shouldAutoSend({ draft, scenario, rules }: Inputs): ShouldAutoSendResult {
  if (!rules.master_enabled) {
    return { send: false, reason: 'master_off' }
  }

  if (rules.global_block_intents.includes(draft.intent)) {
    return { send: false, reason: 'blocked_intent' }
  }

  if (scenario && scenario.autonomy_pct === 0) {
    return { send: false, reason: 'scenario_locked' }
  }

  if (draft.should_escalate) {
    return { send: false, reason: 'emma_escalate' }
  }

  const scenarioPct  = scenario?.autonomy_pct ?? 0
  const threshold    = Math.max(rules.confidence_threshold, scenarioPct / 100)
  if (draft.confidence < threshold) {
    return { send: false, reason: 'confidence_low' }
  }

  return { send: true }
}
