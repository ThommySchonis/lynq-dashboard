import { z } from 'zod'
import { storeIdQuery, paginationQuery } from '@/lib/schemas/common'

export const connectBody = z.object({
  apiKey: z.string().min(1, 'API key is required'),
})

export const trackingQuery = z.object({
  orders: z.string().optional(),
  store_id: z.string().optional(),
})

export const shipmentsQuery = storeIdQuery.merge(paginationQuery).extend({
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
})

/** ParcelPanel v2.0 webhook payload — validates the fields we extract for the shipments upsert. */
export const parcelPanelWebhookPayload = z.object({
  order_number: z.string(),
  tracking_number: z.string(),
  status: z.string(),
  carrier: z.object({
    name: z.string(),
  }),
  customer: z.object({
    name: z.string(),
  }).optional(),
  estimated_delivery_date: z.string().optional(),
})

export type ParcelPanelWebhookPayload = z.infer<typeof parcelPanelWebhookPayload>
