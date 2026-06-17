import { z } from 'zod'
import type { LucideIcon } from 'lucide-react'
import {
  Sparkles,
  ArrowLeftRight,
  Rocket,
  Search,
  ShoppingBag,
  MessageCircle,
  Share2,
  Mic,
  Store,
  Users,
  MoreHorizontal,
} from 'lucide-react'

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
// Mirrors the workspace locales in settings (regional-section): en/nl/de/fr/es.

export interface LocaleOption {
  value: string
  label: string
  short: string
  flag: string
}

export const LOCALE_OPTIONS: LocaleOption[] = [
  { value: 'en', label: 'English', short: 'EN', flag: '🇬🇧' },
  { value: 'nl', label: 'Nederlands', short: 'NL', flag: '🇳🇱' },
  { value: 'de', label: 'Deutsch', short: 'DE', flag: '🇩🇪' },
  { value: 'fr', label: 'Français', short: 'FR', flag: '🇫🇷' },
  { value: 'es', label: 'Español', short: 'ES', flag: '🇪🇸' },
]

// ── Step 1 — Goal ─────────────────────────────────────────────────────────────

export interface GoalOption {
  value: string
  title: string
  description: string
  icon: LucideIcon
}

export const GOAL_OPTIONS: GoalOption[] = [
  {
    value: 'automate',
    title: 'Automate using artificial intelligence.',
    description: "AI manages 'where's my package' and the other 50 inquiries you receive daily.",
    icon: Sparkles,
  },
  {
    value: 'migrate',
    title: 'Transition from a different support system.',
    description: 'Transfer everything from your existing support system.',
    icon: ArrowLeftRight,
  },
  {
    value: 'scratch',
    title: 'Begin anew.',
    description: "New to support? We'll guide you through the process.",
    icon: Rocket,
  },
]

export const goalSchema = z.object({
  name: z.string().min(1, 'Please write your name'),
  brandName: z.string().min(1, "Kindly provide your brand's name."),
  goal: z.enum(['automate', 'migrate', 'scratch']),
})

export type GoalFormData = z.infer<typeof goalSchema>

// ── Step 2 — Account ──────────────────────────────────────────────────────────

export const accountSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z
    .string()
    .min(6, 'At least 6 characters, incl. uppercase, lowercase, number & symbol.'),
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
  icon: LucideIcon
}

export const REFERRAL_OPTIONS: ReferralOption[] = [
  { value: 'google', label: 'Google', icon: Search },
  { value: 'shopify', label: 'Shopify', icon: ShoppingBag },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'social', label: 'Social media', icon: Share2 },
  { value: 'podcast', label: 'Podcast', icon: Mic },
  { value: 'ecommerce', label: 'Ecommerce', icon: Store },
  { value: 'friends', label: 'Friends', icon: Users },
  { value: 'other', label: 'Other', icon: MoreHorizontal },
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
  goal: string | null
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
