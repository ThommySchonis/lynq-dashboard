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

// --- AI Policies (Emma Phase 1–2) ---

export const aiPoliciesQuery = z.object({
  store_id: z.string().uuid(),
})

// NOTE: Fundament and Policies sections both write to the SAME ai_policies row
// via PUT /api/ai/policies. Array fields are therefore `.optional()` (NOT
// `.default([])`): an omitted field is left untouched by the upsert, so saving
// one section never wipes the other section's arrays. An explicit `[]` still
// clears a list. New rows fall back to the DB column default ('[]'::jsonb).
export const aiPoliciesBody = z.object({
  store_id:          z.string().uuid(),
  // Brand identity (Fundament)
  brand_name:        z.string().max(200).optional(),
  brand_description: z.string().max(2000).optional(),
  tone_of_voice:     z.string().max(200).optional(),
  sign_off:          z.string().max(200).optional(),
  languages:         z.array(z.string()).optional(),
  website_url:       z.string().optional(),
  // Policies & Rules (Phase 2)
  shipping_policy:   z.string().max(5000).optional(),
  refund_policy:     z.string().max(5000).optional(),
  customs_policy:    z.string().max(5000).optional(),
  can_decide:        z.array(z.string()).optional(),
  cannot_decide:     z.array(z.string()).optional(),
  escalate_triggers: z.array(z.string()).optional(),
  tracking_url:      z.string().optional(),
})

// --- AI Scenarios (Emma Phase 3) ---

export const aiScenariosQuery = z.object({
  store_id: z.string().uuid(),
})

export const aiScenarioBody = z.object({
  store_id:          z.string().uuid(),
  scenario_key:      z.string().min(1).max(100),
  title:             z.string().max(200).optional(),
  approach:          z.string().max(5000).optional(),
  questions_to_ask:  z.array(z.string()).default([]),
  response_template: z.string().max(5000).optional(),
  escalate_when:     z.string().max(2000).optional(),
  autonomy_pct:      z.number().int().min(0).max(100).default(0),
  enabled:           z.boolean().default(true),
})
