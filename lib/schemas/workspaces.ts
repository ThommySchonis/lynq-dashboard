import { z } from 'zod'
import { idParams, paginationQuery } from '@/lib/schemas/common'

export const memberParams = idParams
export const inviteParams = idParams

const ALLOWED_TIMEZONES = [
  'Europe/Amsterdam', 'Europe/London', 'Europe/Berlin', 'Europe/Paris',
  'Europe/Madrid', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Sao_Paulo', 'Asia/Tokyo', 'Asia/Singapore',
  'Asia/Shanghai', 'Australia/Sydney', 'Pacific/Auckland',
] as const

export const updateWorkspaceBody = z.object({
  name: z.string().min(1, 'Name is required').max(100).optional(),
  slug: z.string().min(3).max(40).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').optional(),
  logo_url: z.string().optional(),
  timezone: z.enum(ALLOWED_TIMEZONES).optional(),
  locale: z.enum(['en', 'nl', 'de', 'fr', 'es']).optional(),
  date_format: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']).optional(),
  time_format: z.enum(['12h', '24h']).optional(),
  first_day_of_week: z.enum(['Sunday', 'Monday']).optional(),
  show_order_data: z.boolean().optional(),
  auto_translate: z.boolean().optional(),
  allow_deletion: z.boolean().optional(),
})

export const inviteMemberBody = z.object({
  email: z.email('Invalid email address'),
  role: z.enum(['admin', 'agent', 'observer']).optional().default('agent'),
})

export const updateMemberBody = z.object({
  role: z.enum(['owner', 'admin', 'agent', 'observer']),
})

export const getMembersQuery = paginationQuery.extend({
  q: z.string().optional(),
  role: z.string().optional(),
  cursor: z.string().optional(),
})
