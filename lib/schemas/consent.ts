import { z } from 'zod'

export const consentSyncBody = z.object({
  level: z.enum(['essential', 'all']),
})

export type ConsentSyncBody = z.infer<typeof consentSyncBody>
