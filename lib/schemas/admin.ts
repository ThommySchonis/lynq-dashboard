import { z } from 'zod'
import { idParams } from '@/lib/schemas/common'

// --- Param schemas ---

export const adminCandidateParams = idParams

// --- Query schemas ---

export const getCandidatesQuery = z.object({
  status: z.string().optional(),
})

export const deleteUserQuery = z.object({
  id: z.string().min(1, 'User ID is required'),
})

// --- Body schemas ---

export const createUserBody = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'agent', 'observer']).optional().default('agent'),
})

export const validateCandidateBody = z.object({
  action: z.enum(['call_validated', 'make_visible', 'hide', 'reject']),
  display_code: z.string().optional(),
})

export const seedDemoBody = z.object({
  user_id: z.string().optional(),
  email: z.string().email('Invalid email address').optional(),
}).refine(
  (data) => data.user_id || data.email,
  { message: 'Either user_id or email is required', path: ['_root'] },
)

export const migrateUsersBody = z.object({
  users: z
    .array(
      z.object({
        id: z.string().optional(),
        email: z.string().email('Invalid email address'),
        password: z.string().min(1, 'Password is required'),
      }),
    )
    .min(1, 'At least one user is required'),
})

// --- Webhook event admin schemas ---

export const listWebhookEventsQuery = z.object({
  status: z.string().optional().default('dead_letter'),
  source: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
})

export const webhookEventIdsBody = z.object({
  ids: z.array(z.string().min(1)).min(1, 'At least one id is required'),
})

export const listCronRunsQuery = z.object({
  jobName: z.string().optional(),
  status: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().min(1).max(500).optional().default(100),
})
