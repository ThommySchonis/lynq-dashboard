import {
  LayoutGrid,
  AtSign,
  UserRound,
  MessageCircle,
  Reply,
  MessagesSquare,
  Megaphone,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import type { NotificationCategory } from '@/types/notifications'

/**
 * Single source of truth for the notifications modal filter tabs.
 *
 * The design (Figma 348-31872) shows six inbox-oriented tabs that have no
 * backing data yet — they render pixel-perfect and resolve to an empty state
 * when selected. `Broadcasts` and `Emma` map to the two real categories the
 * backend currently emits.
 *
 * - `isAll`   → matches every notification.
 * - `category`→ matches notifications of that category.
 * - neither   → placeholder tab; always resolves to zero items (empty state).
 */
export interface NotificationTab {
  key: string
  label: string
  icon: LucideIcon
  isAll?: boolean
  category?: NotificationCategory
}

export const NOTIFICATION_TABS: NotificationTab[] = [
  { key: 'all', label: 'All', icon: LayoutGrid, isAll: true },
  { key: 'mentions', label: 'Mentions', icon: AtSign },
  { key: 'assignments', label: 'Assignments', icon: UserRound },
  { key: 'new_conversations', label: 'New conversations', icon: MessageCircle },
  { key: 'assigned_replies', label: 'Assigned replies', icon: Reply },
  { key: 'participating_replies', label: 'Participating replies', icon: MessagesSquare },
  { key: 'broadcasts', label: 'Broadcasts', icon: Megaphone, category: 'broadcast' },
  { key: 'emma', label: 'Emma', icon: Sparkles, category: 'emma_pending_draft' },
]

/**
 * Per-category row badge: icon + soft-tint background / icon color, using
 * design tokens only (no hardcoded hex). Colors follow the Figma tint system.
 */
export interface NotificationVisual {
  icon: LucideIcon
  /** Tailwind token classes for the 38×38 badge (background + icon color). */
  badgeClass: string
}

export const NOTIFICATION_VISUALS: Record<NotificationCategory, NotificationVisual> = {
  broadcast: { icon: Megaphone, badgeClass: 'bg-info-soft text-info' },
  emma_pending_draft: { icon: Sparkles, badgeClass: 'bg-accent-soft text-primary' },
}
