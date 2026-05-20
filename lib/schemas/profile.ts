import { z } from 'zod'

export const updateProfileBody = z.object({
  display_name: z.string().min(1).max(50).optional(),
  bio: z.string().max(200).optional(),
  theme: z.enum(['system', 'dark', 'light']).optional(),
  dismiss_welcome: z.boolean().optional(),
  welcome_dismissed_at: z.null().optional(),
  dismiss_setup_checklist: z.boolean().optional(),
  setup_checklist_dismissed_at: z.null().optional(),
})
