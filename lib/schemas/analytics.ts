import { z } from 'zod'
import { storeIdQuery, dateRangeQuery } from '@/lib/schemas/common'

// --- Refund Insights ---

export const refundInsightsQuery = storeIdQuery

export const refundInsightsBody = z.object({
  refunds: z.array(z.object({
    orderId: z.union([z.string(), z.number()]),
    refundAmount: z.union([z.string(), z.number()]),
    refundPct: z.union([z.string(), z.number()]),
    reason: z.string().optional(),
    products: z.array(z.string()).optional(),
  })).default([]),
})

// --- Support Analytics (shared query for all 5 support routes) ---

export const supportAnalyticsQuery = dateRangeQuery.extend({
  agent_id: z.string().optional(),
})
