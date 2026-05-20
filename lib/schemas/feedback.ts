import { z } from 'zod'

export const submitFeedbackBody = z.object({
  type: z.enum(['bug', 'feedback', 'other']),
  message: z.string().min(5, 'Message must be at least 5 characters').max(5000, 'Message must be at most 5000 characters'),
  page_url: z.string().max(500).optional(),
  user_agent: z.string().max(500).optional(),
})
