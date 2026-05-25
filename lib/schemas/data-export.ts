import { z } from 'zod'

// Orders and analytics exports accept format + optional store filter
export const exportBody = z.object({
  format: z.enum(['csv', 'pdf']),
  storeId: z.string().uuid().optional(),
})

// Billing export has no storeId
export const billingExportBody = z.object({
  format: z.enum(['csv', 'pdf']),
})
