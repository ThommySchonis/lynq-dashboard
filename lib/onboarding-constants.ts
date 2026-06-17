import { z } from 'zod'
import { LOCALES } from '@/lib/settings-constants'

// ── Step machine ──────────────────────────────────────────────────────────────
// The Figma flow is a 7-step signup wizard (node 776-17277).

export const ONBOARDING_STEPS = [
  'goal',
  'account',
  'confirm',
  'connect-store',
  'team-volume',
  'hear-about',
  'pricing',
] as const

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]
export const TOTAL_STEPS = ONBOARDING_STEPS.length

// ── Header — language selector ────────────────────────────────────────────────
// Derived from the shared workspace LOCALES (settings) + flags for the header pill.

const LOCALE_FLAGS: Record<string, string> = {
  en: '🇬🇧',
  nl: '🇳🇱',
  de: '🇩🇪',
  fr: '🇫🇷',
  es: '🇪🇸',
}

export interface LocaleOption {
  value: string
  label: string
  short: string
  flag: string
}

export const LOCALE_OPTIONS: LocaleOption[] = LOCALES.map((locale) => ({
  ...locale,
  short: locale.value.toUpperCase(),
  flag: LOCALE_FLAGS[locale.value] ?? '🏳️',
}))

// ── Step 1 — Goal ─────────────────────────────────────────────────────────────

export interface GoalOption {
  value: string
  title: string
  description: string
  /** Illustration SVG exported from Figma, served from /public. */
  icon: string
}

export const GOAL_OPTIONS: GoalOption[] = [
  {
    value: 'automate',
    title: 'Automate using artificial intelligence.',
    description: "AI manages 'where's my package' and the other 50 inquiries you receive daily.",
    icon: '/icons/onboarding/goal-automate.svg',
  },
  {
    value: 'migrate',
    title: 'Transition from a different support system.',
    description: 'Transfer everything from your existing support system.',
    icon: '/icons/onboarding/goal-migrate.svg',
  },
  {
    value: 'scratch',
    title: 'Begin anew.',
    description: "New to support? We'll guide you through the process.",
    icon: '/icons/onboarding/goal-scratch.svg',
  },
]

export const goalSchema = z.object({
  name: z.string().min(1, 'Please write your name'),
  brandName: z.string().min(1, "Kindly provide your brand's name."),
  goal: z.enum(['automate', 'migrate', 'scratch']),
})

export type GoalFormData = z.infer<typeof goalSchema>

// ── Step 2 — Account ──────────────────────────────────────────────────────────

const PASSWORD_MESSAGE = 'At least 6 characters, incl. uppercase, lowercase, number & symbol.'

export const accountSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().refine(
    (value) =>
      value.length >= 6 &&
      /[a-z]/.test(value) &&
      /[A-Z]/.test(value) &&
      /[0-9]/.test(value) &&
      /[^A-Za-z0-9]/.test(value),
    PASSWORD_MESSAGE,
  ),
})

export type AccountFormData = z.infer<typeof accountSchema>

// ── Step 5 — Team & volume ────────────────────────────────────────────────────

export const AGENT_COUNT_OPTIONS = ['Just me', '2–5', '6–10', '11–25', '26+'] as const
export const TICKET_VOLUME_OPTIONS = [
  '0 – 100',
  '101 – 500',
  '501 – 2,000',
  '2,001 – 5,000',
  '5,001+',
] as const

// ── Step 6 — Hear about us ────────────────────────────────────────────────────

export interface ReferralOption {
  value: string
  label: string
  /** Brand SVG exported from Figma, served from /public. */
  icon: string
}

export const REFERRAL_OPTIONS: ReferralOption[] = [
  { value: 'google', label: 'Google', icon: '/icons/onboarding/google.svg' },
  { value: 'shopify', label: 'Shopify', icon: '/icons/onboarding/shopify.svg' },
  { value: 'whatsapp', label: 'WhatsApp', icon: '/icons/onboarding/whatsapp.svg' },
  { value: 'social', label: 'Social media', icon: '/icons/onboarding/social.svg' },
  { value: 'podcast', label: 'Podcast', icon: '/icons/onboarding/podcast.svg' },
  { value: 'ecommerce', label: 'Ecommerce', icon: '/icons/onboarding/ecommerce.svg' },
  { value: 'friends', label: 'Friends', icon: '/icons/onboarding/friends.svg' },
  { value: 'other', label: 'Other', icon: '/icons/onboarding/other.svg' },
]

// ── Step 7 — Pricing ──────────────────────────────────────────────────────────

export interface PricingPlan {
  id: 'starter' | 'growth' | 'scale'
  name: string
  pricePrefix?: string
  price: string
  period: string
  tagline: string
  cta: string
  featuresHeading: string
  features: string[]
  highlighted?: boolean
  badge?: string
}

const SHARED_TIER_FEATURES = [
  'Helpdesk inbox',
  'AI agent (manages tickets on your behalf)',
  'Analytics page',
  'Performance page',
  'MCP connection',
  'Value feed',
  'Supply chain tracking',
  'Unlimited agents',
]

// ── Shared wizard state ───────────────────────────────────────────────────────
// UI-first: collected client-side and not yet persisted (backend pass deferred).

export interface WizardData {
  name: string
  brandName: string
  goal: GoalFormData['goal'] | null
  email: string
  password: string
  storeConnected: boolean
  agentCount: string | null
  ticketVolume: string | null
  referral: string | null
  referralDetails: string
  plan: PricingPlan['id'] | null
}

export const INITIAL_WIZARD_DATA: WizardData = {
  name: '',
  brandName: '',
  goal: null,
  email: '',
  password: '',
  storeConnected: false,
  agentCount: null,
  ticketVolume: null,
  referral: null,
  referralDetails: '',
  plan: null,
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: '€59',
    period: '/month',
    tagline: 'Begin with the basics',
    cta: 'Initiate free trial',
    featuresHeading: 'You will receive:',
    features: ['900 outbound emails / month', '600 AI agent replies included', ...SHARED_TIER_FEATURES],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '€149',
    period: '/month',
    tagline: 'Includes 500 AI agent messages and unlimited human representatives',
    cta: 'Initiate free trial',
    badge: 'Suggested for you',
    highlighted: true,
    featuresHeading: 'You will receive:',
    features: ['3,000 outbound emails / month', '2,000 AI agent replies included', ...SHARED_TIER_FEATURES],
  },
  {
    id: 'scale',
    name: 'Scale',
    price: '€399',
    period: '/month',
    tagline: 'Includes 3,000 AI agent messages and unlimited human representatives',
    cta: 'Initiate free trial',
    featuresHeading: 'You will receive:',
    features: ['9,000 outbound emails / month', '6,000 AI agent replies included', ...SHARED_TIER_FEATURES],
  },
]
