import {
  Home, Inbox, BarChart3, Zap, Clock, Package, GraduationCap,
  Rss, Sparkles, Settings,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface SidebarNavItem {
  href: string
  icon: LucideIcon
  label: string
  /** Optional badge source — wired to live data in the sidebar. */
  badgeKey?: 'inbox'
}

export interface SidebarNavGroup {
  /** Collapsible group header text (e.g. "Store Operations"). */
  label: string
  items: SidebarNavItem[]
}

/** Top-level primary navigation (no header, not collapsible). */
export const SIDEBAR_PRIMARY_NAV: SidebarNavItem[] = [
  { href: '/home',        icon: Home,      label: 'Home'        },
  { href: '/inbox',       icon: Inbox,     label: 'Inbox', badgeKey: 'inbox' },
  { href: '/analytics',   icon: BarChart3, label: 'Analytics'   },
  { href: '/performance', icon: Zap,       label: 'Performance' },
]

/** Caption shown above the collapsible groups (Figma 189-13486). */
export const SIDEBAR_GROUPS_CAPTION = 'Operations'

/** Collapsible nav groups, each toggled by a chevron. */
export const SIDEBAR_GROUPS: SidebarNavGroup[] = [
  {
    label: 'Store Operations',
    items: [
      { href: '/time-tracking', icon: Clock,   label: 'Time Tracking' },
      { href: '/supply-chain',  icon: Package, label: 'Supply Chain'  },
      { href: '/value-feed',    icon: Rss,     label: 'Value Feed'    },
    ],
  },
  {
    label: 'Resources',
    items: [
      { href: '/academy',  icon: GraduationCap, label: 'Academy'  },
      { href: '/services', icon: Sparkles,      label: 'Services' },
    ],
  },
]

/**
 * Secondary navigation rendered in the footer, above the user row.
 * Notifications is handled separately by NotificationBell (popover, not a route).
 * Help is rendered separately too (opens the search palette).
 */
export const SIDEBAR_FOOTER_NAV: SidebarNavItem[] = [
  { href: '/settings', icon: Settings, label: 'Settings' },
]
