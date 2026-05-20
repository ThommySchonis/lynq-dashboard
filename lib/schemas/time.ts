import { z } from 'zod'
import { sessionIdParams, dateRangeQuery } from '@/lib/schemas/common'

export const timeSessionParams = sessionIdParams

export const getTimeQuery = dateRangeQuery.extend({
  filter: z.enum(['today', 'week', 'month', 'custom']).optional(),
})

export const timeActionBody = z.object({
  action: z.enum(['clock-in', 'pause', 'resume', 'clock-out', 'heartbeat']),
  session_id: z.string().optional(),
  report: z.object({
    emails_answered: z.number().int().min(0),
    what_went_well: z.string().max(2000),
    needs_attention: z.string().max(2000),
  }).optional(),
})

export const editSessionBody = z.object({
  clocked_in_at: z.string().optional(),
  clocked_out_at: z.string().nullable().optional(),
  emails_answered: z.number().int().min(0).nullable().optional(),
  what_went_well: z.string().max(2000).nullable().optional(),
  needs_attention: z.string().max(2000).nullable().optional(),
  reason: z.string().min(3, 'Reason must be at least 3 characters'),
})
