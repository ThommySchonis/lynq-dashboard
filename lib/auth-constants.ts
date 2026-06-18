import type { LucideIcon } from 'lucide-react'
import { Check } from 'lucide-react'

// ── Password strength ──
export const PASSWORD_MIN = 8

export function calcPasswordStrength(pw: string): number {
  if (!pw) return 0
  let score = 0
  if (pw.length >= PASSWORD_MIN)             score++
  if (pw.length >= 12)                       score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw))                      score++
  if (/[^a-zA-Z0-9]/.test(pw))              score++
  return Math.min(score, 4)
}

export const STRENGTH_COLORS = ['bg-red-500', 'bg-orange-500', 'bg-yellow-400', 'bg-green-500']
export const STRENGTH_LABELS = ['Weak', 'Fair', 'Good', 'Strong']
export const STRENGTH_BG_IDLE = 'bg-white/10'

// ── Trust items (signup) ──
export interface TrustItem {
  icon: LucideIcon
  text: string
}

export const TRUST_ITEMS: TrustItem[] = [
  { icon: Check, text: 'No credit card' },
  { icon: Check, text: '7-day trial' },
  { icon: Check, text: 'Cancel anytime' },
]

// ── Animation ──
export const WORD_REVEAL_DELAY_MS = 100

// ── Auth copy (shared across the redesigned auth screens) ──
export const PASSWORD_HINT_8 =
  'At least 8 characters, incl. uppercase, lowercase, number & symbol.'
export const EMAIL_PLACEHOLDER = 'e.g., user_email@gmail.com'
