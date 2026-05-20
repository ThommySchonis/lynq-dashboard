import { z } from 'zod'
import { TAG_COLORS, sanitizeTagName } from '@/lib/tags'
import { idParams } from '@/lib/schemas/common'

export const tagParams = idParams

export const createTagBody = z.object({
  name: z.string().min(1, 'Name is required').transform(sanitizeTagName),
  color: z.enum(TAG_COLORS as [string, ...string[]]).optional().default('slate'),
  description: z.string().max(200).optional(),
})

export const updateTagBody = z.object({
  name: z.string().min(1).transform(sanitizeTagName).optional(),
  color: z.enum(TAG_COLORS as [string, ...string[]]).optional(),
  description: z.string().max(200).optional(),
})

export const mergeTagsBody = z.object({
  winner_id: z.string().min(1, 'winner_id is required'),
  loser_ids: z.array(z.string().min(1)).min(1, 'At least one loser_id is required'),
})
