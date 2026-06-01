// lib/services/ai-prompt-builder.ts
//
// Emma — builds the system prompt from completed onboarding data
// (ai_policies + enabled ai_scenarios). Used by /api/ai/reply ONLY when
// getOnboardingStatus(...).isComplete is true; otherwise the route keeps its
// legacy ai_settings / DEFAULT_SYSTEM_PROMPT path.
//
// Section/template style mirrors lib/aiMacros.ts (SYSTEM_PROMPT + builder).
// The conversation/customer context is NOT added here — the route appends it
// as the user prompt exactly as before. autonomy_pct is intentionally omitted
// (Phase 2 concern).
//
// Section order: Brand identity → Policies → Scenarios → Recent learnings →
// Output. Output stays last so the model has all upstream context before
// being told the output format.

import { CANONICAL_SCENARIO_TITLES } from './ai-onboarding'
import type { AiLesson, AiPolicies, AiScenario } from './ai-onboarding'
import {
  CANCELLATION_WINDOW_OPTIONS,
  toneOfVoiceForKey,
} from '@/lib/constants/emma-onboarding'

const has = (v: string | null | undefined): v is string => !!v && v.trim().length > 0
const hasList = (v: string[] | null | undefined): v is string[] => Array.isArray(v) && v.length > 0
const bullets = (items: string[]): string => items.map((i) => `- ${i}`).join('\n')

/** Map the cancellation_window enum key to its human label for the prompt
 *  (mirrors the dropdown in the UI so the model sees what the merchant sees). */
function cancellationWindowLabel(key: string | null | undefined): string | null {
  if (!key) return null
  const found = CANCELLATION_WINDOW_OPTIONS.find((o) => o.key === key)
  return found?.label ?? null
}

/** Combine a multi-select list + free-form notes into a single prose paragraph.
 *  Returns an empty string when both sides are empty so the caller can skip
 *  the section header entirely. */
function combineOptionsAndNotes(options: string[] | null, notes: string | null): string {
  const optionsTrimmed = (options ?? []).map((o) => o.trim()).filter(Boolean)
  const notesTrimmed   = (notes ?? '').trim()
  if (optionsTrimmed.length === 0 && !notesTrimmed) return ''
  const parts: string[] = []
  if (optionsTrimmed.length > 0) parts.push(bullets(optionsTrimmed))
  if (notesTrimmed)              parts.push(`Additional notes: ${notesTrimmed}`)
  return parts.join('\n')
}

export function buildEmmaSystemPrompt(
  policies: AiPolicies,
  scenarios: AiScenario[],
  lessons: AiLesson[] = []
): string {
  const sections: string[] = []

  const brandName = has(policies.brand_name) ? policies.brand_name.trim() : 'the brand'
  sections.push(
    `You are the customer support agent for ${brandName}. Write a helpful, on-brand reply to the customer using the brand identity, policies, and scenario guidance below. Never invent order details, tracking numbers, or policies you do not have.`
  )

  // ── Brand identity ──
  // tone_of_voice is now an enum (TONE_OF_VOICE_KEYS in lib/schemas/ai.ts).
  // toneOfVoiceForKey returns the canonical option (or the default
  // 'persoonlijk_eigenaar' option for legacy free-text values), and we
  // inject its prompt_snippet — that's where the actual tone instructions
  // live (Notion §2 verbatim).
  const brand: string[] = ['## Brand identity']
  if (has(policies.brand_name))        brand.push(`Brand name: ${policies.brand_name.trim()}`)
  if (has(policies.brand_description)) brand.push(`About: ${policies.brand_description.trim()}`)

  const tone = toneOfVoiceForKey(policies.tone_of_voice)
  brand.push(`Tone of voice: ${tone.label}`)
  brand.push(tone.prompt_snippet)

  if (has(policies.sign_off))    brand.push(`Sign off with: ${policies.sign_off.trim()}`)
  if (has(policies.website_url)) brand.push(`Website: ${policies.website_url.trim()}`)
  // Languages auto-detect — Emma always replies in the customer's language.
  brand.push("Always reply in the same language as the customer's most recent message. Detect the language from their text — do not ask which language to use.")
  sections.push(brand.join('\n'))

  // ── Policies ──
  // can_decide_options / cannot_decide_options each combine with their _notes
  // field into a single prose paragraph (one bullet list + an "Additional
  // notes" line when present). Empty sides drop the whole sub-section.
  const pol: string[] = ['## Policies']
  if (has(policies.shipping_policy)) pol.push(`Shipping policy: ${policies.shipping_policy.trim()}`)
  if (has(policies.refund_policy))   pol.push(`Refund policy: ${policies.refund_policy.trim()}`)
  if (has(policies.customs_policy))  pol.push(`Customs policy: ${policies.customs_policy.trim()}`)

  const canDecide = combineOptionsAndNotes(policies.can_decide_options, policies.can_decide_notes)
  if (canDecide) pol.push(`You may decide on your own:\n${canDecide}`)

  const cannotDecide = combineOptionsAndNotes(policies.cannot_decide_options, policies.cannot_decide_notes)
  if (cannotDecide) pol.push(`You may NOT decide on your own — these require human review:\n${cannotDecide}`)

  if (has(policies.parcelpanel_url)) pol.push(`ParcelPanel tracking URL: ${policies.parcelpanel_url.trim()}`)

  const cwLabel = cancellationWindowLabel(policies.cancellation_window)
  if (cwLabel) pol.push(`Cancellation window: ${cwLabel}`)

  if (has(policies.tracking_url)) pol.push(`Tracking URL template: ${policies.tracking_url.trim()}`)
  if (pol.length > 1) sections.push(pol.join('\n'))

  // ── Scenarios (enabled only) ──
  // Five fields per scenario: Triggers / Approach / Must do / Must not do /
  // Escalate when. Each renders only when filled, so partially configured
  // scenarios still produce something useful for the model.
  const enabled = scenarios.filter((s) => s.enabled !== false)
  const scenarioBlocks = enabled
    .map((s) => {
      const title = CANONICAL_SCENARIO_TITLES[s.scenario_key] ?? s.title ?? s.scenario_key
      const lines: string[] = [`### ${title}`]
      if (has(s.triggers))      lines.push(`Triggers: ${s.triggers.trim()}`)
      if (has(s.approach))      lines.push(`Approach: ${s.approach.trim()}`)
      if (has(s.must_do))       lines.push(`Must do: ${s.must_do.trim()}`)
      if (has(s.must_not_do))   lines.push(`Must not do: ${s.must_not_do.trim()}`)
      if (has(s.escalate_when)) lines.push(`Escalate when: ${s.escalate_when.trim()}`)
      // Only emit a block if the scenario carries real guidance beyond its title.
      return lines.length > 1 ? lines.join('\n') : ''
    })
    .filter(Boolean)

  if (scenarioBlocks.length > 0) {
    const scenarioReinforcement = "Follow each scenario's must-do / must-not-do rules strictly. These override any example phrasing or general inclinations."
    sections.push(['## Scenarios', ...scenarioBlocks, scenarioReinforcement].join('\n\n'))
  }

  // ── Recent learnings (manual lessons from Settings → AI agent → Lessons) ──
  // Placed AFTER scenarios so brand + policies + scenarios anchor the
  // response shape first, and lessons refine it. The query-side LIMIT lives
  // in getEnabledLessons (lib/services/ai-onboarding.ts) — this builder
  // formats whatever it receives. Section is omitted entirely when the list
  // is empty (no empty header).
  const lessonBullets = lessons
    .map((l) => {
      const text = l.lesson_text.trim()
      if (!text) return ''
      return l.applies_to_scenario ? `- [${l.applies_to_scenario}] ${text}` : `- ${text}`
    })
    .filter(Boolean)

  if (lessonBullets.length > 0) {
    sections.push(['## Recent learnings', ...lessonBullets].join('\n'))
  }

  // ── Structured output guidance ──
  // Emma replies are generated as a structured object (see emmaReplyOutput in
  // lib/schemas/ai.ts). Tell the model how to fill the classification fields
  // alongside the reply text. Instructive, not verbose. Placed LAST so the
  // model has all brand + policy + scenario + lesson context before being
  // told the output format. Intent list is the 10-value REPLY_INTENTS post
  // onboarding refactor (wismo → order_status, wrong_or_damaged →
  // wrong_or_damaged_item, refund_or_cancel → refund_or_return, plus the
  // new 'cancellation' value).
  sections.push(
    `## Output
Return the reply together with a short classification:
- reply: the customer-facing reply only — no metadata or explanations.
- intent: the customer's underlying question. Map to one of: order_status, long_delivery, lost_package, wrong_or_damaged_item, refund_or_return, cancellation, customs_fees, angry_or_chargeback. Use 'other' for on-topic but unmapped requests, 'unknown' for genuinely unclear or off-topic messages.
- confidence: 0–1, be honest. >=0.85 when the scenario maps cleanly and the policies cover the case; 0.5–0.85 when handleable but uncertain; <0.5 when the policies don't cover this or the intent is unclear.
- should_escalate: true when an escalate trigger above applies, when intent is angry_or_chargeback, or when confidence is low.
- escalate_reason: a short phrase explaining why — only when should_escalate is true, otherwise null.`
  )

  return sections.join('\n\n')
}
