import { z } from 'zod'
import { idParams } from '@/lib/schemas/common'

// --- Candidate params (dynamic route [id]) ---

export const candidateParams = idParams

// --- Candidates list query ---

export const getCandidatesQuery = z.object({
  role: z.string().optional(),
  availability: z.string().optional(),
})

// --- Profile update ---

export const updateProfileBody = z.object({
  photo_url: z.string().url().optional(),
  experience_years: z.number().int().min(0).optional(),
  previous_industries: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  hourly_rate: z.number().min(0).optional(),
  availability: z.string().optional(),
  tools_experience: z.array(z.string()).optional(),
  about: z.string().max(5000).optional(),
})

// --- Purchase ---

export const purchaseBody = z.object({
  talent_profile_id: z.string().min(1, 'talent_profile_id is required'),
  include_trainer: z.boolean().optional(),
  company_name: z.string().optional(),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  notes: z.string().max(2000).optional(),
})
