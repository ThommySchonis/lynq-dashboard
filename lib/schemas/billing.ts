import { z } from 'zod'
import { idParams } from '@/lib/schemas/common'

// --- Params ---

export const billingIdParams = idParams

// --- Query schemas ---

export const invoicesQuery = z.object({
  page: z.coerce.number().int().min(0).optional(),
  per_page: z.coerce.number().int().min(1).max(100).optional(),
})

// --- Body schemas ---

export const updateBillingInfoBody = z.object({
  billing_email: z.string().optional(),
  organization_name: z.string().optional(),
  phone_number: z.string().nullable().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().nullable().optional(),
  city: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  state: z.string().nullable().optional(),
  vat_number: z.string().nullable().optional(),
})

export const changePlanBody = z.object({
  plan_id: z.string().min(1, 'plan_id is required'),
  success_url: z.string().optional(),
})
