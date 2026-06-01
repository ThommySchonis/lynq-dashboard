// lib/services/ai-prompt-builder.ts
//
// Emma Phase 1 — builds the system prompt from completed onboarding data
// (ai_policies + enabled ai_scenarios). Used by /api/ai/reply ONLY when
// getOnboardingStatus(...).isComplete is true; otherwise the route keeps its
// legacy ai_settings / DEFAULT_SYSTEM_PROMPT path.
//
// Section/template style mirrors lib/aiMacros.ts (SYSTEM_PROMPT + builder).
// The conversation/customer context is NOT added here — the route appends it
// as the user prompt exactly as before. autonomy_pct is intentionally omitted
// (Phase 2 concern).

import { CANONICAL_SCENARIO_TITLES } from './ai-onboarding'
import type { AiPolicies, AiScenario } from './ai-onboarding'

const has = (v: string | null | undefined): v is string => !!v && v.trim().length > 0
const hasList = (v: string[] | null | undefined): v is string[] => Array.isArray(v) && v.length > 0
const bullets = (items: string[]): string => items.map((i) => `- ${i}`).join('\n')

export function buildEmmaSystemPrompt(policies: AiPolicies, scenarios: AiScenario[]): string {
  const sections: string[] = []

  const brandName = has(policies.brand_name) ? policies.brand_name.trim() : 'the brand'
  sections.push(
    `You are the customer support agent for ${brandName}. Write a helpful, on-brand reply to the customer using the brand identity, policies, and scenario guidance below. Never invent order details, tracking numbers, or policies you do not have.`
  )

  // ── Brand identity ──
  const brand: string[] = ['## Brand identity']
  if (has(policies.brand_name)) brand.push(`Brand name: ${policies.brand_name.trim()}`)
  if (has(policies.brand_description)) brand.push(`About: ${policies.brand_description.trim()}`)
  if (has(policies.tone_of_voice)) brand.push(`Tone of voice: ${policies.tone_of_voice.trim()}`)
  if (has(policies.sign_off)) brand.push(`Sign off with: ${policies.sign_off.trim()}`)
  if (hasList(policies.languages)) brand.push(`Languages: ${policies.languages.join(', ')}`)
  if (has(policies.website_url)) brand.push(`Website: ${policies.website_url.trim()}`)
  if (brand.length > 1) sections.push(brand.join('\n'))

  // ── Policies ──
  const pol: string[] = ['## Policies']
  if (has(policies.shipping_policy)) pol.push(`Shipping policy: ${policies.shipping_policy.trim()}`)
  if (has(policies.refund_policy)) pol.push(`Refund policy: ${policies.refund_policy.trim()}`)
  if (has(policies.customs_policy)) pol.push(`Customs policy: ${policies.customs_policy.trim()}`)
  if (hasList(policies.can_decide)) pol.push(`You may decide on your own:\n${bullets(policies.can_decide)}`)
  if (hasList(policies.cannot_decide)) pol.push(`You may NOT decide on your own:\n${bullets(policies.cannot_decide)}`)
  if (hasList(policies.escalate_triggers)) pol.push(`Always escalate to a human when:\n${bullets(policies.escalate_triggers)}`)
  if (has(policies.tracking_url)) pol.push(`Tracking URL template: ${policies.tracking_url.trim()}`)
  if (pol.length > 1) sections.push(pol.join('\n'))

  // ── Scenarios (enabled only) ──
  const enabled = scenarios.filter((s) => s.enabled !== false)
  const scenarioBlocks = enabled
    .map((s) => {
      const title = CANONICAL_SCENARIO_TITLES[s.scenario_key] ?? s.title ?? s.scenario_key
      const lines: string[] = [`### ${title}`]
      if (has(s.approach)) lines.push(`Approach: ${s.approach.trim()}`)
      if (hasList(s.questions_to_ask)) lines.push(`Ask first:\n${bullets(s.questions_to_ask)}`)
      if (has(s.response_template)) lines.push(`Response template: ${s.response_template.trim()}`)
      if (has(s.escalate_when)) lines.push(`Escalate when: ${s.escalate_when.trim()}`)
      // Only emit a block if the scenario carries real guidance beyond its title.
      return lines.length > 1 ? lines.join('\n') : ''
    })
    .filter(Boolean)

  if (scenarioBlocks.length > 0) {
    sections.push(['## Scenarios', ...scenarioBlocks].join('\n\n'))
  }

  // ── Structured output guidance ──
  // Emma replies are generated as a structured object (see emmaReplyOutput in
  // lib/schemas/ai.ts). Tell the model how to fill the classification fields
  // alongside the reply text. Instructive, not verbose.
  sections.push(
    `## Output
Return the reply together with a short classification:
- reply: the customer-facing reply only — no metadata or explanations.
- intent: the customer's underlying question. Map to one of: wismo, long_delivery, lost_package, wrong_or_damaged, refund_or_cancel, customs_fees, angry_or_chargeback. Use 'other' for on-topic but unmapped requests, 'unknown' for genuinely unclear or off-topic messages.
- confidence: 0–1, be honest. >=0.85 when the scenario maps cleanly and the policies cover the case; 0.5–0.85 when handleable but uncertain; <0.5 when the policies don't cover this or the intent is unclear.
- should_escalate: true when an escalate trigger above applies, when intent is angry_or_chargeback, or when confidence is low.
- escalate_reason: a short phrase explaining why — only when should_escalate is true, otherwise null.`
  )

  return sections.join('\n\n')
}
