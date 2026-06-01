// lib/constants/emma-onboarding.ts
//
// Locked content from the Emma Onboarding Refactor spec.
// Source of truth: Notion page "📋 Emma — Onboarding Refactor Content Spec".
// Sections §1.2 (Agent autonomy presets), §2 (Tone-of-voice options),
// §3 (8 canonical scenarios with human-readable titles).
//
// This file holds the user-facing copy + the prompt-snippet payloads that
// the prompt builder injects. The schema (lib/schemas/ai.ts) holds the
// enum keys that gate validation; this file holds everything keyed off
// those enum values.

import type { ToneOfVoiceKey, CancellationWindowKey } from '@/lib/schemas/ai'

// ─── Tone of voice (Notion §2) ───────────────────────────────────────

export interface ToneOfVoiceOption {
  key:            ToneOfVoiceKey
  label:          string
  /** Snippet injected into Emma's system prompt under the brand-identity
   *  section. Authored to be drop-in usable as a sentence. */
  prompt_snippet: string
}

export const TONE_OF_VOICE_OPTIONS: ToneOfVoiceOption[] = [
  {
    key:            'persoonlijk_eigenaar',
    label:          'Persoonlijk vanuit de eigenaar',
    prompt_snippet: 'Write as if you\'re the brand\'s founder personally responding to this customer. Warm, human, one-on-one. Use "I" and "we" naturally. No corporate language, no "according to our records" phrasing.',
  },
  {
    key:            'vriendelijk_warm',
    label:          'Vriendelijk & warm',
    prompt_snippet: 'Write warmly and supportively, like a helpful retail associate who genuinely cares. Empathetic without being overly familiar. Acknowledge feelings before solving problems.',
  },
  {
    key:            'professioneel_verzorgd',
    label:          'Professioneel & verzorgd',
    prompt_snippet: 'Write professionally with polish. Slightly more formal but still personable. Suited for premium/luxury brand positioning. Avoid slang and casual contractions.',
  },
  {
    key:            'direct_efficient',
    label:          'Direct & efficiënt',
    prompt_snippet: 'Be concise and to-the-point while still warm. Get to the answer quickly. No filler, no excess apologizing. Suited for B2B and efficiency-focused brands.',
  },
]

/** Default for new rows / when no value is stored / when a legacy free-text
 *  value can't be coerced to any known key. */
export const DEFAULT_TONE_OF_VOICE: ToneOfVoiceKey = 'persoonlijk_eigenaar'

/** Look up a tone-of-voice option by its key, falling back to the default
 *  when the key is unknown (legacy free-text from before the enum). */
export function toneOfVoiceForKey(key: string | null | undefined): ToneOfVoiceOption {
  const found = TONE_OF_VOICE_OPTIONS.find((o) => o.key === key)
  return found ?? TONE_OF_VOICE_OPTIONS.find((o) => o.key === DEFAULT_TONE_OF_VOICE)!
}

// ─── Agent autonomy presets (Notion §1.2) ────────────────────────────

/** The 8 predefined items the merchant can multi-select for "Agent can decide". */
export const CAN_DECIDE_PREDEFINED: string[] = [
  'Resend tracking links',
  'Share order status',
  'Provide product info',
  'Apologize for delays',
  'Offer existing discount codes',
  'Confirm/update shipping address',
  'Send replacement product info',
  'Update customer with carrier ETA',
]

/** The 8 predefined items the merchant can multi-select for "Agent cannot decide". */
export const CANNOT_DECIDE_PREDEFINED: string[] = [
  'Issue refunds',
  'Approve returns outside policy',
  'Make exceptions to refund policy',
  'Issue store credit / gift cards',
  'Cancel orders that have shipped',
  'Handle chargebacks',
  'Negotiate prices',
  'Make safety/medical claims',
]

// ─── Cancellation window (Notion §1.3) ───────────────────────────────

export interface CancellationWindowOption {
  key:   CancellationWindowKey
  label: string
}

export const CANCELLATION_WINDOW_OPTIONS: CancellationWindowOption[] = [
  { key: '4h',   label: '4 uur'                  },
  { key: '12h',  label: '12 uur'                 },
  { key: '24h',  label: '24 uur'                 },
  { key: 'none', label: 'Geen annulering mogelijk' },
]

/** Default for new rows. Per Notion §1.3. */
export const DEFAULT_CANCELLATION_WINDOW: CancellationWindowKey = '24h'

// ─── Canonical scenarios (Notion §3) ─────────────────────────────────

export interface CanonicalScenarioMeta {
  key:   string
  title: string
  /** Per-scenario autonomy_pct lock — only chargeback locks to 0% per the
   *  existing scenario-row pattern (mirror of scenarios-section.tsx). */
  lockAutonomy?: boolean
}

/** Source of truth for the canonical scenario list across the codebase
 *  (prompt builder, settings UI, autonomy decision, lessons schema enum).
 *  Order matters: this is the order shown to the merchant in the UI. */
export const CANONICAL_SCENARIOS: CanonicalScenarioMeta[] = [
  { key: 'order_status',          title: 'Where is my order?'             },
  { key: 'long_delivery',         title: 'Long delivery time'             },
  { key: 'lost_package',          title: 'Lost package'                   },
  { key: 'wrong_or_damaged_item', title: 'Wrong or damaged item'          },
  { key: 'refund_or_return',      title: 'Refund or return'               },
  { key: 'cancellation',          title: 'Cancellation'                   },
  { key: 'customs_fees',          title: 'Customs fees'                   },
  { key: 'angry_or_chargeback',   title: 'Angry customer or chargeback', lockAutonomy: true },
]

/** Just the keys, in canonical order. Convenient for iteration in the
 *  completeness check and the prompt builder. */
export const CANONICAL_SCENARIO_KEYS: string[] = CANONICAL_SCENARIOS.map((s) => s.key)

/** Quick lookup table for human-readable titles by scenario_key. */
export const CANONICAL_SCENARIO_TITLES: Record<string, string> = Object.fromEntries(
  CANONICAL_SCENARIOS.map((s) => [s.key, s.title]),
)
