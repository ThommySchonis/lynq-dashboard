import { z } from 'zod'
import { storeIdQuery, idParams } from '@/lib/schemas/common'

// --- Param schemas ---

export const shopifyOrderParams = idParams

// --- Query schemas ---

export const shopifyStoreQuery = storeIdQuery

export const shopifyStoreWithDateQuery = storeIdQuery.extend({
  from: z.string().optional(),
  to: z.string().optional(),
})

export const shopifyRevenueTrendQuery = storeIdQuery.extend({
  from: z.string().optional(),
  to: z.string().optional(),
})

export const shopifySyncQuery = storeIdQuery.extend({
  full: z.enum(['true', 'false']).optional(),
})

export const shopifyCustomerQuery = storeIdQuery.extend({
  email: z.string().optional(),
  order: z.string().optional(),
})

// --- Body schemas ---

export const shopifyManualConnectBody = z.object({
  shop: z.string().min(1, 'Shop domain is required'),
  accessToken: z.string().min(1, 'Access token is required'),
})

export const shopifyLinkBody = z.object({
  shop: z.unknown(),
})

// Legacy routes: body contains orderId + passthrough params
export const legacyCancelOrderBody = z.object({
  orderId: z.string().min(1, 'orderId is required'),
}).passthrough()

export const legacyDuplicateOrderBody = z.object({
  orderId: z.string().min(1, 'orderId is required'),
}).passthrough()

export const legacyEditAddressBody = z.object({
  orderId: z.string().min(1, 'orderId is required'),
}).passthrough()

export const legacyRefundOrderBody = z.object({
  orderId: z.string().min(1, 'orderId is required'),
}).passthrough()

// [id] action routes: passthrough bodies sent to Shopify service functions
export const shopifyPassthroughBody = z.record(z.string(), z.unknown())

// Note update has a constrained shape
export const updateNoteBody = z.object({
  note: z.string().max(5000),
}).passthrough()

// Address update has a constrained shape
export const updateAddressBody = z.object({
  address1: z.string().optional(),
  address2: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  country: z.string().optional(),
  zip: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
}).passthrough()

export const shopifyProductSearchQuery = storeIdQuery.extend({
  q: z.string().min(1, 'q is required'),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

export const shippingAddressInputSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  address1: z.string().optional(),
  address2: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  country: z.string().optional(),
  zip: z.string().optional(),
  phone: z.string().optional(),
})

export const createDraftOrderBody = z.object({
  customerId: z.string().min(1, 'customerId is required'),
  lineItems: z
    .array(
      z.object({
        variantId: z.string().min(1, 'variantId is required'),
        quantity: z.number().int().min(1).max(999),
      })
    )
    .min(1, 'At least one line item is required'),
  shippingAddress: shippingAddressInputSchema.optional(),
  discount: z
    .object({
      type: z.enum(['percentage', 'fixed']),
      value: z.number().positive(),
    })
    .optional(),
  note: z.string().max(5000).optional(),
})
