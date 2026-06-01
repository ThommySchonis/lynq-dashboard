import { z } from 'zod'

// --- AI Chat ---

const storeKPIs = z.object({
  totalOrders: z.number().optional(),
  netRevenue: z.number().optional(),
  refundRate: z.number().optional(),
  cancelledOrders: z.number().optional(),
})

const storeOrder = z.object({
  name: z.string(),
  total: z.number(),
  financialStatus: z.string(),
  fulfillmentStatus: z.string(),
  customer: z.string(),
  hasRefund: z.boolean().optional(),
  cancelReason: z.string().optional(),
})

const storeRefund = z.object({
  orderId: z.string(),
  refundAmount: z.number(),
  products: z.array(z.string()).optional(),
  customer: z.string(),
})

const storeContext = z.object({
  kpis: storeKPIs.optional(),
  orders: z.array(storeOrder).optional(),
  refunds: z.array(storeRefund).optional(),
})

export const aiChatBody = z.object({
  message: z.string().min(1, 'Message is required'),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional().default([]),
  context: storeContext.optional(),
})

// --- AI Reply ---

const threadMessage = z.object({
  from: z.string().optional(),
  date: z.string().optional(),
  body: z.string().optional(),
  snippet: z.string().optional(),
})

export const aiReplyBody = z.object({
  messages: z.array(threadMessage).min(1, 'At least one message is required'),
  threadId: z.string().optional(),
  language: z.string().optional(),
})

// --- AI Analyze ---

const threadInput = z.object({
  id: z.string().min(1),
  subject: z.string().optional(),
  snippet: z.string().optional(),
})

export const aiAnalyzeBody = z.object({
  threads: z.array(threadInput).min(1, 'At least one thread is required'),
})

// --- AI Translate ---

export const aiTranslateBody = z.object({
  text: z.string().min(1, 'Text is required').max(10000),
  targetLang: z.string().optional(),
  detectOnly: z.boolean().optional(),
})

// --- AI Macros ---

export const aiMacrosBody = z.object({
  subject: z.string().max(500).optional(),
  snippet: z.string().max(10000).optional(),
})

// --- AI Policies (Emma Onboarding refactor) ---

// Strict enum for tone_of_voice. The DB column stays `text` so old free-text
// values remain readable; PUT bodies must use one of these four keys. The
// UI coerces legacy values to 'persoonlijk_eigenaar' on next save.
export const TONE_OF_VOICE_KEYS = [
  'persoonlijk_eigenaar',
  'vriendelijk_warm',
  'professioneel_verzorgd',
  'direct_efficient',
] as const

export const CANCELLATION_WINDOW_KEYS = ['4h', '12h', '24h', 'none'] as const

export const aiPoliciesQuery = z.object({
  store_id: z.string().uuid(),
})

// NOTE: Fundament and Policies sections both write to the SAME ai_policies row
// via PUT /api/ai/policies. Array fields are therefore `.optional()` (NOT
// `.default([])`): an omitted field is left untouched by the upsert, so saving
// one section never wipes the other section's arrays. An explicit `[]` still
// clears a list. New rows fall back to the DB column default ('[]'::jsonb).
export const aiPoliciesBody = z.object({
  store_id:               z.string().uuid(),
  // Brand identity (Fundament)
  brand_name:             z.string().max(200).optional(),
  brand_description:      z.string().max(2000).optional(),
  tone_of_voice:          z.enum(TONE_OF_VOICE_KEYS).optional(),
  sign_off:               z.string().max(200).optional(),
  website_url:            z.string().optional(),
  // Policies & Rules
  shipping_policy:        z.string().max(5000).optional(),
  refund_policy:          z.string().max(5000).optional(),
  customs_policy:         z.string().max(5000).optional(),
  can_decide_options:     z.array(z.string()).optional(),
  can_decide_notes:       z.string().max(5000).optional(),
  cannot_decide_options:  z.array(z.string()).optional(),
  cannot_decide_notes:    z.string().max(5000).optional(),
  parcelpanel_url:        z.string().optional(),
  cancellation_window:    z.enum(CANCELLATION_WINDOW_KEYS).optional(),
  tracking_url:           z.string().optional(),
})

export type ToneOfVoiceKey       = (typeof TONE_OF_VOICE_KEYS)[number]
export type CancellationWindowKey = (typeof CANCELLATION_WINDOW_KEYS)[number]

// --- AI Scenarios (Emma onboarding refactor — 5 fields per scenario) ---

export const aiScenariosQuery = z.object({
  store_id: z.string().uuid(),
})

export const aiScenarioBody = z.object({
  store_id:          z.string().uuid(),
  scenario_key:      z.string().min(1).max(100),
  title:             z.string().max(200).optional(),
  triggers:          z.string().max(5000).optional(),
  approach:          z.string().max(5000).optional(),
  must_do:           z.string().max(5000).optional(),
  must_not_do:       z.string().max(5000).optional(),
  escalate_when:     z.string().max(5000).optional(),
  // Kept for backwards compatibility on the wire (old UI may still send these
  // — they're harmless if the new UI omits them). New code reads triggers /
  // must_do / must_not_do instead.
  questions_to_ask:  z.array(z.string()).default([]),
  response_template: z.string().max(5000).optional(),
  autonomy_pct:      z.number().int().min(0).max(100).default(0),
  enabled:           z.boolean().default(true),
})

// --- AI Lessons (Emma learn loop v1) ---

// Mirrors CANONICAL_SCENARIO_KEYS in lib/services/ai-onboarding.ts. Re-declared
// here so the schemas folder stays free of service-layer imports (every other
// schema file in lib/schemas does the same). 8 keys post-refactor (was 7).
const CANONICAL_SCENARIO_KEYS_TUPLE = [
  'order_status',
  'long_delivery',
  'lost_package',
  'wrong_or_damaged_item',
  'refund_or_return',
  'cancellation',
  'customs_fees',
  'angry_or_chargeback',
] as const

export const aiLessonsQuery = z.object({
  store_id: z.string().uuid(),
})

export const aiLessonsBody = z.object({
  store_id:            z.string().uuid(),
  lesson_text:         z.string().trim().min(1, 'Lesson text is required').max(2000),
  // null / omitted → applies to all scenarios
  applies_to_scenario: z.enum(CANONICAL_SCENARIO_KEYS_TUPLE).nullable().optional(),
})

export const aiLessonParams = z.object({
  id: z.string().uuid(),
})

export const aiLessonPatchBody = z.object({
  enabled: z.boolean(),
})

// --- AI Reply structured output (Emma path only) ---

// The 8 canonical scenario keys + 'other'/'unknown', matching the intent CHECK
// constraint on ai_drafts after 20260603000001_ai_scenarios_onboarding_refactor.sql
// and the scenario keys in the settings UI.
export const REPLY_INTENTS = [
  'order_status',
  'long_delivery',
  'lost_package',
  'wrong_or_damaged_item',
  'refund_or_return',
  'cancellation',
  'customs_fees',
  'angry_or_chargeback',
  'other',
  'unknown',
] as const

// Structured-output schema for generateText({ experimental_output: Output.object }).
// `reply` carries the reply body returned to the inbox UI unchanged; the other
// fields are persisted on the ai_drafts row.
export const emmaReplyOutput = z.object({
  reply:           z.string(),
  intent:          z.enum(REPLY_INTENTS),
  confidence:      z.number().min(0).max(1),
  should_escalate: z.boolean(),
  escalate_reason: z.string().nullable().optional(),
})

export type ReplyIntent = (typeof REPLY_INTENTS)[number]

// --- AI Autonomy Rules (Emma Phase 2 — gated auto-send) ---

// Defaults applied by GET /api/ai/autonomy-rules when no row exists yet.
// Auto-send is OFF by default; refund_or_return, cancellation, and
// angry_or_chargeback are blocked out of the gate (Notion §5). Surfaced
// through the schema (via .default) so the GET route and UI share one
// source of truth.
export const DEFAULT_AUTONOMY_CONFIG = {
  master_enabled:       false,
  confidence_threshold: 0.85,
  global_block_intents: ['refund_or_return', 'cancellation', 'angry_or_chargeback'],
} as const

export const aiAutonomyRulesQuery = z.object({
  store_id: z.string().uuid(),
})

// Strict shape. Every field is required so the UI cannot accidentally drop
// one. confidence_threshold is bounded 0–1 to match the slider; intents must
// be one of the 10 REPLY_INTENTS so the decision logic always has a valid
// comparison target.
export const aiAutonomyRulesConfig = z.object({
  master_enabled:       z.boolean(),
  confidence_threshold: z.number().min(0).max(1),
  global_block_intents: z.array(z.enum(REPLY_INTENTS)),
})

export const aiAutonomyRulesBody = z.object({
  store_id: z.string().uuid(),
  config:   aiAutonomyRulesConfig,
})

export type AiAutonomyRulesConfig = z.infer<typeof aiAutonomyRulesConfig>
