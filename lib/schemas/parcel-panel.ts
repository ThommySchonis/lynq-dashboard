import { z } from 'zod'
import { storeIdQuery, paginationQuery } from '@/lib/schemas/common'

export const connectBody = z.object({
  apiKey: z.string().min(1, 'API key is required'),
})

export const setupBody = z.object({
  apiKey: z.string().min(10, 'Invalid API key format'),
})

export const trackingQuery = z.object({
  orders: z.string().optional(),
  store_id: z.string().optional(),
})

export const shipmentsQuery = storeIdQuery.merge(paginationQuery).extend({
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
})
