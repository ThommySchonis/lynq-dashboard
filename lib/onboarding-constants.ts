export type Tone = 'friendly' | 'professional' | 'luxury'
export type Language = 'English' | 'Dutch' | 'French' | 'German' | 'Spanish'

export const STEPS = ['Welcome', 'Brand Setup', 'Connect Tools', 'Done'] as const

export const TONE_OPTIONS: { value: Tone; label: string; example: string }[] = [
  { value: 'friendly',     label: 'Friendly & informal',  example: '"Hey! Thanks for reaching out 😊"' },
  { value: 'professional', label: 'Professional & warm',  example: '"Thank you for contacting us."' },
  { value: 'luxury',       label: 'Luxury & formal',      example: '"We sincerely appreciate you reaching out."' },
]

export const LANGUAGE_OPTIONS: Language[] = ['English', 'Dutch', 'French', 'German', 'Spanish']
