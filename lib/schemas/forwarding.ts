import { z } from 'zod'

export const forwardingEmailConnectBody = z.object({
  email: z.string().email('Valid email is required'),
  store_id: z.string().optional(),
})

export const forwardingEmailVerifyBody = z.object({
  account_id: z.string().min(1, 'Account ID is required'),
})

export const forwardingEmailStatusQuery = z.object({
  account_id: z.string().min(1, 'Account ID is required'),
})
