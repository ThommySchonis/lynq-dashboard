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
