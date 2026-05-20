import { z } from 'zod'

export const translateBody = z.object({
  text: z.string().min(1).max(10000),
  targetLanguage: z.string().optional().default('English'),
})
