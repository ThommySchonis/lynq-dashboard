import { z } from 'zod'
import { storeIdQuery } from '@/lib/schemas/common'

// --- Brand Settings ---

export const updateBrandBody = z.object({
  brandName: z.string().min(1).max(200),
  language: z.string().min(1),
  tone: z.string().min(1),
})

// --- Integrations ---

export const saveIntegrationQuery = storeIdQuery

export const saveIntegrationBody = z.object({
  parcelpanel_api_key: z.string().optional(),
})

// --- Email Integration ---

export const emailIntegrationBody = z.object({
  provider: z.enum(['gmail', 'outlook']),
})

// --- Shopify Integration ---

export const shopifyIntegrationQuery = z.object({
  store_id: z.string().optional(),
})

export const shopifyIntegrationBody = z.object({
  domain: z.string().min(1, 'Domain is required'),
})
