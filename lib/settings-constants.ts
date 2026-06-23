/**
 * Shared constants for settings pages.
 * Import from here instead of defining inline in components.
 */

import {
  Monitor, Moon, Sun,
  SlidersHorizontal, Users, Zap, Tag, Store, CreditCard,
  Flag, BookOpen, ListChecks, Mail, ArrowLeftRight,
  User, Lock, Plug,
  type LucideIcon,
} from 'lucide-react'
import type { MemberRole, Theme } from '@/types/settings'
import type { can } from '@/lib/permissions'
// ── Navigation ──

export interface SettingsNavItem {
  label: string
  href: string
  /** Leading icon shown in the settings sidebar. */
  Icon: LucideIcon
  /** Capability required to see this item. Omitted = always visible. */
  capability?: keyof typeof can
}

export interface SettingsNavGroup {
  label: string
  items: SettingsNavItem[]
}

const RAW_SETTINGS_NAV: SettingsNavGroup[] = [
  { label: 'WORKSPACE', items: [
    { label: 'General',  href: '/settings/workspace/general', Icon: SlidersHorizontal, capability: 'manageWorkspace' },
    { label: 'Users',    href: '/settings/workspace/members', Icon: Users,    capability: 'inviteMembers'  },
    { label: 'Macros',   href: '/settings/workspace/macros',  Icon: Zap,      capability: 'viewMacros'     },
    { label: 'Tags',     href: '/settings/workspace/tags',    Icon: Tag,      capability: 'viewTags'       },
    { label: 'Stores',   href: '/settings/workspace/stores',  Icon: Store,    capability: 'manageWorkspace' },
    { label: 'Billing',  href: '/settings/workspace/billing', Icon: CreditCard, capability: 'manageBilling'  },
  ]},
  { label: 'AI AGENT', items: [
    { label: 'Onboarding', href: '/settings/ai-agent/onboarding', Icon: Flag,       capability: 'manageWorkspace' },
    { label: 'Lessons',    href: '/settings/ai-agent/lessons',    Icon: BookOpen,   capability: 'manageWorkspace' },
    { label: 'Rules',      href: '/settings/ai-agent/rules',      Icon: ListChecks, capability: 'manageWorkspace' },
  ]},
  { label: 'AI ASSISTANTS', items: [
    { label: 'MCP', href: '/settings/ai-assistants/mcp', Icon: Plug, capability: 'manageWorkspace' },
  ]},
  { label: 'INTEGRATIONS', items: [
    { label: 'Email Display',    href: '/settings/integrations/email-display', Icon: Mail,           capability: 'manageWorkspace' },
    { label: 'Data Migration',   href: '/settings/integrations/migrations',    Icon: ArrowLeftRight, capability: 'manageMigrations' },
  ]},
  { label: 'PERSONAL', items: [
    { label: 'Profile',        href: '/settings/personal/profile',  Icon: User },
    { label: 'Password & 2FA', href: '/settings/personal/security', Icon: Lock },
  ]},
]

export const SETTINGS_NAV: SettingsNavGroup[] = RAW_SETTINGS_NAV

/** Flat list of all settings items — use for search/filtering. */
export const ALL_SETTINGS_ITEMS: Array<SettingsNavItem & { group: string }> =
  SETTINGS_NAV.flatMap(g => g.items.map(item => ({ ...item, group: g.label })))

/**
 * Filters the settings nav by the current role's capabilities.
 * Items without a `capability` are always kept; groups left empty are dropped.
 */
export function visibleSettingsNav(
  caps: Record<keyof typeof can, boolean>,
): SettingsNavGroup[] {
  return SETTINGS_NAV
    .map(group => ({
      ...group,
      items: group.items.filter(item => !item.capability || caps[item.capability]),
    }))
    .filter(group => group.items.length > 0)
}

// ── Roles ──

/** Roles selectable when inviting a new member (non-owner cannot assign owner). */
export const ROLES: MemberRole[] = ['admin', 'agent', 'observer']

/** Full role set — only owners can assign any of these. */
export const ROLES_FOR_OWNER: MemberRole[] = ['owner', 'admin', 'agent', 'observer']

/** Roles an admin can assign (cannot promote to owner). */
export const ROLES_FOR_ADMIN: MemberRole[] = ['admin', 'agent', 'observer']

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner:    'Owner',
  admin:    'Admin',
  agent:    'Agent',
  observer: 'Observer',
}

/** Short descriptions shown in invite dropdowns. */
export const ROLE_DESCS: Partial<Record<MemberRole, string>> = {
  admin:    'Manage workspace & users',
  agent:    'Handle tickets & Shopify',
  observer: 'View-only access',
}

/** Full descriptions shown in member detail views. */
export const ROLE_DESCS_FULL: Record<MemberRole, string> = {
  owner:    'Full access including billing',
  admin:    'Manage workspace and members',
  agent:    'Handle tickets and customers',
  observer: 'View-only access',
}

// ── Workspace ──

export const TIMEZONES: string[] = [
  'Europe/Amsterdam', 'Europe/London', 'Europe/Berlin', 'Europe/Paris',
  'Europe/Madrid', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Sao_Paulo', 'Asia/Tokyo', 'Asia/Singapore',
  'Asia/Shanghai', 'Australia/Sydney', 'Pacific/Auckland',
]

/** Workspace locales — single source of truth for the settings picker and onboarding header. */
export interface WorkspaceLocale {
  value: string
  label: string
}

export const LOCALES: WorkspaceLocale[] = [
  { value: "en", label: "English" },
  // { value: 'nl', label: 'Nederlands' },
  // { value: 'de', label: 'Deutsch' },
  // { value: 'fr', label: 'Français' },
  // { value: 'es', label: 'Español' },
];

export interface WorkspaceDefaults {
  name: string
  slug: string
  logo_url: null
  timezone: string
  locale: string
  date_format: string
  time_format: string
  first_day_of_week: string
  show_order_data: boolean
  auto_translate: boolean
  allow_deletion: boolean
}

export const WORKSPACE_DEFAULTS: WorkspaceDefaults = {
  name: '', slug: '', logo_url: null,
  timezone: 'Europe/Amsterdam', locale: 'en',
  date_format: 'DD/MM/YYYY', time_format: '24h', first_day_of_week: 'Monday',
  show_order_data: true, auto_translate: false, allow_deletion: false,
}

// ── Profile / Theme ──

export interface ThemeOption {
  value: Theme
  label: string
  desc: string
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
}

export const THEMES: ThemeOption[] = [
  { value: 'system', label: 'System', desc: 'Match your device setting', Icon: Monitor },
  { value: 'dark',   label: 'Dark',   desc: 'Always use dark mode',     Icon: Moon    },
  { value: 'light',  label: 'Light',  desc: 'Always use light mode',    Icon: Sun     },
]

// ── Macros ──

export interface MacroLanguageOption {
  value: string
  label: string
}

/**
 * Language filter options for the macros list page.
 * The empty string `''` represents "All languages".
 * Language codes overlap with `MACRO_LANGS` from `lib/macros.ts`;
 * this list adds the display labels and the "All" sentinel.
 */
export const MACRO_LANGUAGES: MacroLanguageOption[] = [
  { value: '',     label: 'All languages' },
  { value: 'auto', label: 'Auto detect'   },
  { value: 'en',   label: 'English'       },
  { value: 'nl',   label: 'Dutch'         },
  { value: 'fr',   label: 'French'        },
  { value: 'de',   label: 'German'        },
  { value: 'es',   label: 'Spanish'       },
  { value: 'it',   label: 'Italian'       },
]

/** Map from language code (or `'all'`) to display label. */
export const MACRO_LANG_LABEL: Record<string, string> = Object.fromEntries(
  MACRO_LANGUAGES.map(l => [l.value || 'all', l.label])
)

// ── Wizard ──

export interface BrandVoiceOption {
  value: string
  desc: string
}

export const BRAND_VOICES: BrandVoiceOption[] = [
  { value: 'Warm & personal',          desc: 'Friendly, warm, expresses care'              },
  { value: 'Professional & efficient', desc: 'Direct, clear, polite, no fluff'             },
  { value: 'Casual & friendly',        desc: 'Conversational, contractions OK'             },
  { value: 'Luxury & elegant',         desc: 'Refined, sophisticated, never casual'        },
  { value: 'Playful & fun',            desc: 'Warm with personality, exclamations OK'      },
]

export const RETURN_SHIPPING: string[] = [
  'Customer pays return shipping',
  'We cover all return shipping',
  'Free returns above certain order value',
]

export const DAMAGE_POLICY: string[] = [
  'We cover return postage + replacement or refund',
  'Customer sends photos first, then we decide',
  'Customer pays return as normal',
]

export interface WizardStep {
  title: string
  desc: string
}

export const WIZARD_STEPS: WizardStep[] = [
  { title: 'Brand basics',       desc: 'Tell us who you are and what you sell.'         },
  { title: 'Contact & shipping', desc: 'How customers reach you and track orders.'      },
  { title: 'Returns & refunds',  desc: 'Your policies for returns, refunds, damages.'   },
  { title: 'Final touch',        desc: 'Anything else AI should know about your store.' },
]

// ── Initial form states ──

export interface PasswordForm {
  current_password: string
  new_password: string
  confirm_password: string
}

export const INITIAL_PASSWORD_FORM: PasswordForm = {
  current_password: '',
  new_password: '',
  confirm_password: '',
}

export interface CustomEmailForm {
  email: string
  imapHost: string
  imapPort: string
  smtpHost: string
  smtpPort: string
  username: string
  password: string
}

export const INITIAL_CUSTOM_EMAIL_FORM: CustomEmailForm = {
  email:    '',
  imapHost: '',
  imapPort: '993',
  smtpHost: '',
  smtpPort: '587',
  username: '',
  password: '',
}

export interface MacroWizardForm {
  store_name:      string
  what_sells:      string
  brand_voice:     string
  support_email:   string
  signature:       string
  tracking_link:   string
  return_days:     number
  return_shipping: string
  damage_policy:   string
  extra_notes:     string
}

export const INITIAL_MACRO_WIZARD_FORM: MacroWizardForm = {
  store_name:      '',
  what_sells:      '',
  brand_voice:     '',
  support_email:   '',
  signature:       '',
  tracking_link:   '',
  return_days:     30,
  return_shipping: '',
  damage_policy:   '',
  extra_notes:     '',
}
