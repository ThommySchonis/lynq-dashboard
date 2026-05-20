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
