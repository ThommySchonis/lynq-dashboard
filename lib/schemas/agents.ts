import { z } from 'zod'

// --- Agents ---

export const createAgentBody = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.email('Invalid email address'),
})

export const deleteAgentBody = z.object({
  id: z.string().min(1, 'Agent ID is required'),
})

// --- Agent Actions ---

export const agentActionBody = z.object({
  thread_id: z.string().optional(),
  action_type: z.enum(['reply', 'close', 'refund_processed']),
  response_time_seconds: z.number().min(0).optional(),
})

// --- Agent Performance ---

export const agentPerformanceQuery = z.object({
  filter: z.enum(['day', 'week', 'month', 'lastmonth', 'custom']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})
