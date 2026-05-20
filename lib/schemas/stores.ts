import { z } from 'zod'
import { idParams } from '@/lib/schemas/common'

export const storeParams = idParams

export const emailConfigParams = z.object({
  id: z.string().min(1, 'Store ID is required'),
  configId: z.string().min(1, 'Config ID is required'),
})

export const updateStoreBody = z.object({
  name: z.string().min(1, 'Store name is required').max(200),
})
