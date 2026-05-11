import { Bug, Lightbulb, MessageSquare } from 'lucide-react'
import type React from 'react'

export type FeedbackType = 'bug' | 'feedback' | 'other'
export type FilterKey = 'all' | FeedbackType

export interface TypeMeta {
  label: string
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  badgeBg: string
  badgeText: string
}

export const TYPE_META: Record<FeedbackType, TypeMeta> = {
  bug:      { label: 'Bug',      Icon: Bug,           badgeBg: 'bg-red-100',    badgeText: 'text-red-500' },
  feedback: { label: 'Feedback', Icon: Lightbulb,     badgeBg: 'bg-purple-100', badgeText: 'text-[#A175FC]' },
  other:    { label: 'Other',    Icon: MessageSquare, badgeBg: 'bg-[#F1EEF5]',  badgeText: 'text-[#6B5E7B]' },
}

export const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'bug',      label: 'Bug' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'other',    label: 'Other' },
]
