import { z } from 'zod'

// Orders and analytics exports accept format + store
export const exportBody = z.object({
  format: z.enum(['csv', 'pdf']),
  storeId: z.string().uuid(),
})

// Billing export has no storeId
export const billingExportBody = z.object({
  format: z.enum(['csv', 'pdf']),
})

// Performance (support-analytics) export: format + on-screen range + optional agent
export const supportExportBody = z.object({
  format: z.enum(['csv', 'pdf']),
  from: z.string(),
  to: z.string(),
  agentId: z.string().uuid().nullable().optional(),
})
