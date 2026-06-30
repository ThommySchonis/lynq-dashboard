import type { LucideIcon } from 'lucide-react'
import { Download, CalendarCheck, Mic, LineChart, Workflow } from 'lucide-react'

/** AI hero suggestion chips (wording from Figma node 776-17280). */
export const SUGGESTIONS = [
  'Top refunded products this month',
  "What's my revenue this month?",
  'Which orders are unfulfilled?',
  'Refund rate trend',
] as const

export interface PromoCardConfig {
  key: string
  icon: LucideIcon
  /** Leading title text rendered before the optional emphasized word. */
  title: string
  /** Optional emphasized trailing word (e.g. the platform name). */
  titleEmphasis?: string
  description: string
}

/** Static promo cards shown on the home dashboard. */
export const IMPORT_PROMO: PromoCardConfig = {
  key: 'import-gorgias',
  icon: Download,
  title: 'Import from',
  titleEmphasis: 'Gorgias',
  description:
    'Bring your tickets, customers, macros and tags. Your old helpdesk stays live while we import.',
}

export const ONBOARDING_CALL_PROMO: PromoCardConfig = {
  key: 'onboarding-call',
  icon: CalendarCheck,
  title: 'Book a free onboarding call',
  description: 'Get 1-on-1 help from our team to walk through your setup.',
}

export interface ComingSoonItem {
  key: string
  icon: LucideIcon
  title: string
  description: string
}

/** "Coming soon to Lynq" feature teasers (Figma node 776-17280). */
export const COMING_SOON_ITEMS: ComingSoonItem[] = [
  {
    key: 'voice-support',
    icon: Mic,
    title: 'Voice support',
    description:
      'Handle calls and voicemails in the same inbox, with AI transcripts and summaries.',
  },
  {
    key: 'advanced-analytics',
    icon: LineChart,
    title: 'Advanced analytics',
    description:
      'Deeper insight into team performance, AI resolution and CSAT trends.',
  },
  {
    key: 'workflow-automations',
    icon: Workflow,
    title: 'Workflow automations',
    description:
      'Build no-code rules to route, tag and auto-resolve conversations.',
  },
]

/** Where the home AI hero sends the user to start a conversation. */
export const CHAT_ROUTE = '/chat'

/** Calendly link for the onboarding-call promo card. */
export const CALENDLY_ONBOARDING_URL =
  process.env.NEXT_PUBLIC_CALENDLY_ONBOARDING_URL ??
  'https://calendly.com/info-lynqagency/discovery-call-clone'

/**
 * "Get started" checklist steps (Figma node 776-17280).
 * - `auto` steps derive their done state from the onboarding status RPC.
 * - `manual` steps have no backend signal; "Mark as done" is stored in localStorage.
 */
export interface ChecklistStep {
  key: string
  label: string
  description: string
  href: string
  cta: string
  type: 'auto' | 'manual'
}

export const CHECKLIST_STEPS: ChecklistStep[] = [
  {
    key: 'email',
    label: 'Connect email',
    description: 'Link your support inbox so conversations sync into Lynq automatically.',
    href: '/settings/integrations/email',
    cta: 'Connect',
    type: 'auto',
  },
  {
    key: 'shopify',
    label: 'Connect the Store',
    description:
      'Sync your Shopify store to import live customer profiles, order history, and tracking details.',
    href: '/settings/integrations/shopify',
    cta: 'Connect',
    type: 'auto',
  },
  {
    key: 'macros',
    label: "Build the Macro's",
    description: 'Pre-made responses with variables. Apply to tickets with one click.',
    href: '/settings/workspace/macros/generate',
    cta: 'Build',
    type: 'auto',
  },
  {
    key: 'configure_ai',
    label: 'Configurate AI Agent',
    description:
      'Teach the AI agent about a store’s brand, policies, example replies, and how to handle common support scenarios.',
    href: '/settings/ai-agent/rules',
    cta: 'Configurate',
    type: 'manual',
  },
  {
    key: 'train_ai',
    label: 'Train AI Agent',
    description:
      'Teach Emma specific corrections that the onboarding doesn’t cover. Lessons apply to one scenario or all.',
    href: '/settings/ai-agent/lessons',
    cta: 'Train',
    type: 'manual',
  },
  {
    key: 'team',
    label: 'Invite Team',
    description: 'Manage who has access to this workspace and their roles.',
    href: '/settings/workspace/members',
    cta: 'Invite',
    type: 'auto',
  },
  {
    key: 'mcp',
    label: 'Connect Claude and ChatGPT via MCP',
    description:
      'Run your Lynq & Flow workspace straight from Claude or ChatGPT — look up tickets, refine Emma’s instructions and draft help articles right inside the chat.',
    href: '/settings',
    cta: 'Connect',
    type: 'manual',
  },
]

/** localStorage key for manually-completed checklist steps. */
export const CHECKLIST_MANUAL_STORAGE_KEY = 'lynq:onboarding-manual-steps'
