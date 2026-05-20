import { z } from 'zod'
import { idParams, storeIdOptionalQuery } from '@/lib/schemas/common'

// --- Params ---

export const conversationParams = idParams
export const accountParams = idParams

// --- Body schemas ---

export const composeBody = z.object({
  to: z.array(z.string()).min(1, 'At least one recipient is required'),
  cc: z.array(z.string()).optional(),
  bcc: z.array(z.string()).optional(),
  subject: z.string().min(1, 'Subject is required').max(500),
  bodyHtml: z.string().optional(),
  bodyText: z.string().optional(),
  accountId: z.string().optional(),
}).refine((data) => data.bodyHtml || data.bodyText, {
  message: 'Message body required (bodyHtml or bodyText)',
  path: ['bodyHtml'],
})

export const replyBody = z.object({
  to: z.array(z.string()).optional(),
  cc: z.array(z.string()).optional(),
  bcc: z.array(z.string()).optional(),
  subject: z.string().optional(),
  bodyHtml: z.string().optional(),
  bodyText: z.string().optional(),
}).refine((data) => data.bodyHtml || data.bodyText, {
  message: 'Message body required (bodyHtml or bodyText)',
  path: ['bodyHtml'],
})

export const updateConversationBody = z.object({
  status: z.enum(['open', 'pending', 'resolved', 'closed']).optional(),
  is_unread: z.boolean().optional(),
  assigned_to: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const createNoteBody = z.object({
  body: z.string().min(1, 'Note body required').max(5000),
})

export const linkCustomerBody = z.object({
  shopifyCustomerId: z.string().min(1, 'shopifyCustomerId required'),
})

// --- Query schemas ---

export const getConversationsQuery = z.object({
  status: z.string().optional(),
  unlinked: z.enum(['true', 'false']).optional(),
  search: z.string().max(200).optional(),
  store_id: z.string().optional(),
  page: z.coerce.number().int().min(0).optional(),
})

export const getAccountsQuery = storeIdOptionalQuery

export const getCountsQuery = storeIdOptionalQuery

export const shopifyCustomerQuery = z.object({
  q: z.string().optional(),
  id: z.string().optional(),
  store_id: z.string().optional(),
}).refine((data) => data.q || data.id, {
  message: 'q or id parameter required',
  path: ['q'],
})
