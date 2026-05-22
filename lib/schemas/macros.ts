import { z } from 'zod'
import { idParams } from '@/lib/schemas/common'

export const macroParams = idParams

export const getMacrosQuery = z.object({
  archived: z.enum(['true', 'false']).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  language: z.string().optional(),
  tags: z.string().optional(),
})

export const macroOnboardingBody = z.object({
  answers: z.object({
    store_name: z.string().min(1, 'Store name is required').max(200),
    what_sells: z.string().min(1, 'What you sell is required').max(500),
    brand_voice: z.enum([
      'Warm & personal',
      'Professional & efficient',
      'Casual & friendly',
      'Luxury & elegant',
      'Playful & fun',
    ], { message: 'Invalid brand voice' }),
    support_email: z.string().email('Invalid support email').max(200),
    signature: z.string().min(1, 'Signature is required').max(300),
    return_days: z.coerce.number().int().min(1).max(365),
    return_shipping: z.enum([
      'Customer pays return shipping',
      'We cover all return shipping',
      'Free returns above certain order value',
    ], { message: 'Invalid return shipping policy' }),
    damage_policy: z.enum([
      'We cover return postage + replacement or refund',
      'Customer sends photos first, then we decide',
      'Customer pays return as normal',
    ], { message: 'Invalid damage policy' }),
    tracking_link: z.string().max(500).optional().default(''),
    extra_notes: z.string().max(2000).optional().default(''),
  }),
})
