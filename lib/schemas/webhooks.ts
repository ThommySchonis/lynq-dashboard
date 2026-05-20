import { z } from 'zod'

export const shopifyWebhookQuery = z.object({
  cid: z.string().optional(),
  store_id: z.string().optional(),
})

export const emailDnsQuery = z.object({
  domain: z.string().min(1, 'Domain is required'),
  provider: z.enum(['google', 'microsoft', 'custom']).optional(),
})
