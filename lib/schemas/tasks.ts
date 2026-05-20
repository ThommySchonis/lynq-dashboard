import { z } from 'zod'
import { idParams, storeIdQuery, paginationQuery } from '@/lib/schemas/common'

export const taskParams = idParams

export const getTasksQuery = paginationQuery.extend({
  status: z.enum(['open', 'picked_up', 'done']).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  assignee: z.string().optional(),
})

export const createTaskBody = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(5000).optional(),
  category: z.string().max(100).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  assignedTo: z.string().optional(),
  shopifyOrderId: z.string().optional(),
  shopifyOrderName: z.string().optional(),
  shopifyCustomerId: z.string().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().optional(),
})

export const updateTaskBody = z.object({
  status: z.enum(['open', 'picked_up', 'done']).optional(),
  assignedTo: z.string().nullable().optional(),
  resultNote: z.string().max(5000).optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  category: z.string().max(100).optional(),
})

export const generateTasksQuery = storeIdQuery
