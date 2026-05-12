import { z } from 'zod'

export type Tone = 'friendly' | 'professional' | 'luxury'
export type Language = 'English' | 'Dutch' | 'French' | 'German' | 'Spanish'

export const brandSchema = z.object({
  brandName: z.string().min(1, 'Brand name is required'),
  language: z.enum(['English', 'Dutch', 'French', 'German', 'Spanish']),
  tone: z.enum(['friendly', 'professional', 'luxury']),
})

export type BrandFormData = z.infer<typeof brandSchema>

export const STEPS = ['Welcome', 'Brand Setup', 'Connect Tools', 'Done'] as const

export const TONE_OPTIONS: { value: Tone; label: string; example: string }[] = [
  { value: 'friendly',     label: 'Friendly & informal',  example: '"Hey! Thanks for reaching out 😊"' },
  { value: 'professional', label: 'Professional & warm',  example: '"Thank you for contacting us."' },
  { value: 'luxury',       label: 'Luxury & formal',      example: '"We sincerely appreciate you reaching out."' },
]

export const LANGUAGE_OPTIONS: Language[] = ['English', 'Dutch', 'French', 'German', 'Spanish']
