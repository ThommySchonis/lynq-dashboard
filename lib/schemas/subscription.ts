import { z } from 'zod'

export const activateSubscriptionBody = z.object({
  plan: z.enum(['starter', 'pro', 'scale']).optional().default('starter'),
  email: z.string().email().optional(),
})
