import { z } from 'zod'

// --- Primitives ---

export const uuidParam = z.uuid('Invalid ID format')
export const emailField = z.email('Invalid email address')

// --- Reusable query schemas ---

export const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

export const storeIdQuery = z.object({
  store_id: z.string().min(1, 'store_id is required'),
})

export const storeIdOptionalQuery = z.object({
  store_id: z.string().optional(),
})

export const dateRangeQuery = z.object({
  date_from: z.string().optional(),
  date_to: z.string().optional(),
})

// --- Reusable param schemas ---

export const idParams = z.object({
  id: z.string().min(1, 'ID is required'),
})

export const tokenParams = z.object({
  token: z.string().min(1, 'Token is required'),
})

export const sessionIdParams = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
})
