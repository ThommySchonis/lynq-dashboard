'use client'

import { Zap, Phone, MessageSquare, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { SubscriptionAddon } from '@/types/billing'

interface AddonRowProps {
  addon:        SubscriptionAddon
  onSubscribe?: (addonId: string) => void
  isLoading?:   boolean
  className?:   string
}

const ICON_MAP: Record<string, typeof Zap> = {
  ai_agent: Zap,
  voice:    Phone,
  sms:      MessageSquare,
  convert:  MessageCircle,
}

/**
 * Compact horizontal row for add-on products in the billing page.
 * Replaces the previous card-grid layout — these rows stack under the
 * Helpdesk card in the same left column so the right Summary panel
 * stays sticky over the full page height.
 *
 * Left:  icon (32px, neutral #F4F4F5 bg) + product name + status badge
 * Right: "Starting at €X/month" sub-text, or Subscribe CTA for live add-ons
 *
 * Colors #F4F4F5 / #E5E0EB are the Linear-neutral palette used across
 * this billing surface — they intentionally don't share a Tailwind
 * token with the project's purple-tinted --secondary/--muted.
 */
export function AddonRow({ addon, onSubscribe, isLoading, className }: AddonRowProps) {
  const Icon = ICON_MAP[addon.id] ?? Zap
  const isComingSoon = addon.status === 'coming_soon'
  const isActive     = addon.workspace_status === 'active'

  const priceLabel = addon.per_unit_price_eur != null
    ? `Starting at €${Number(addon.per_unit_price_eur).toFixed(2)} ${addon.per_unit_label || ''}`.trim()
    : addon.price_eur != null
      ? `Starting at €${Number(addon.price_eur).toFixed(0)}/month`
      : ''

  return (
    <div
      className={cn(
        'flex min-h-14 items-center justify-between gap-4 rounded-[10px] border-[0.5px] border-[#E5E0EB] bg-white px-5 py-[14px] transition-colors',
        isComingSoon && 'opacity-95',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#F4F4F5]">
          <Icon size={16} strokeWidth={1.75} className="text-foreground/70" />
        </div>
        <span className="truncate text-sm font-medium text-foreground">
          {addon.display_name}
        </span>
        {isComingSoon && (
          <Badge variant="secondary" className="shrink-0 whitespace-nowrap">Coming Soon</Badge>
        )}
        {isActive && !isComingSoon && (
          <Badge variant="default" className="shrink-0 whitespace-nowrap">Active</Badge>
        )}
      </div>

      <div className="shrink-0">
        {isComingSoon || isActive ? (
          priceLabel && (
            <span className="whitespace-nowrap text-xs text-muted-foreground">{priceLabel}</span>
          )
        ) : (
          <Button
            type="button"
            size="sm"
            variant="default"
            disabled={isLoading}
            onClick={() => onSubscribe?.(addon.id)}
          >
            Subscribe
          </Button>
        )}
      </div>
    </div>
  )
}
