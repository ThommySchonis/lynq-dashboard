import { z } from 'zod'

const VALID_EXAM_TYPES = ['customer_service', 'supply_chain', 'dispute_management', 'overall_manager'] as const

// --- Exam Questions ---

export const examQuestionsQuery = z.object({
  type: z.enum(VALID_EXAM_TYPES),
})

// --- Submit Exam ---

export const submitExamBody = z.object({
  exam_type: z.enum(VALID_EXAM_TYPES),
  answers: z.record(z.string(), z.string()),
})

// --- Exam Result ---

export const examResultQuery = z.object({
  type: z.string().optional(),
})
