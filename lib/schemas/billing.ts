import { z } from 'zod'
import { idParams } from '@/lib/schemas/common'

// --- Params ---

export const billingIdParams = idParams

// --- Body schemas ---

export const setBillingStoreSchema = z.object({
  integration_id: z.string().uuid(),
})
