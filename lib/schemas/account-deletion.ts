import { z } from 'zod'

export const scheduleAccountDeletionBody = z.object({
  workspaceAction: z.enum(['delete']).optional(),
})
