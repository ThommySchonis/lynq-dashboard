'use client'

import { Zap, Phone, MessageSquare, MessageCircle, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SubscriptionAddon } from '@/types/billing'

interface AddonRowProps {
  addon:        SubscriptionAddon
  onAddProduct?: (addonId: string) => void
  className?:   string
}

const ICON_MAP: Record<string, typeof Zap> = {
  ai_agent: Zap,
  voice:    Phone,
  sms:      MessageSquare,
  convert:  MessageCircle,
}

/**
 * Single-line add-on row rendered inside the parent "Select Plans"
 * card. No own background or border — the card and its divide-y
 * dividers provide visual separation.
 *
 * Right side renders a "+ Add Product" text link. Coming-soon add-ons
 * keep the same visual but are disabled (cannot actually be added until
 * the product is live).
 */
export function AddonRow({ addon, onAddProduct, className }: AddonRowProps) {
  const Icon = ICON_MAP[addon.id] ?? Zap
  const isComingSoon = addon.status === 'coming_soon'

  return (
    <div className={cn('flex items-center justify-between gap-4 px-6 py-4', className)}>
      <div className="flex min-w-0 items-center gap-3">
        <Icon size={18} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-medium text-foreground">
          {addon.display_name}
        </span>
      </div>

      <button
        type="button"
        onClick={() => onAddProduct?.(addon.id)}
        disabled={isComingSoon}
        title={isComingSoon ? 'Coming soon — not yet available' : undefined}
        className="flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-medium text-foreground transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus size={14} strokeWidth={2} />
        Add Product
      </button>
    </div>
  )
}
