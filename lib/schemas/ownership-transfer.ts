import { z } from 'zod'

export const initiateTransferBody = z.object({
  toUserId: z.string().uuid('Invalid user ID'),
  newRoleForOldOwner: z.enum(['admin', 'agent', 'observer']),
})
