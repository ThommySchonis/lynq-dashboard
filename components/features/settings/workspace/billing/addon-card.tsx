'use client'

import { Zap, Phone, MessageSquare, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { SubscriptionAddon } from '@/types/billing'

interface AddonCardProps {
  addon:       SubscriptionAddon
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
 * Add-on card — renders AI Agent / Voice / SMS / Meta & Instagram
 * comments with their `coming_soon` state. Coming-soon add-ons show
 * only the badge in the top-right and the price as sub-text — no
 * separate CTA button (keeps the layout calm).
 */
export function AddonCard({ addon, onSubscribe, isLoading, className }: AddonCardProps) {
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
        'flex flex-col gap-4 rounded-xl border border-border bg-card p-5 transition-all',
        isComingSoon && 'opacity-90',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-foreground/5">
            <Icon size={20} strokeWidth={1.75} className="text-foreground/70" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold text-foreground">{addon.display_name}</span>
            {addon.description && (
              <span className="text-xs text-muted-foreground">{addon.description}</span>
            )}
            {priceLabel && (
              <span className="mt-1 text-xs text-muted-foreground">{priceLabel}</span>
            )}
          </div>
        </div>
        {isComingSoon && <Badge variant="secondary">Coming Soon</Badge>}
        {isActive && !isComingSoon && <Badge variant="default">Active</Badge>}
      </div>

      {/* Live add-ons keep a Subscribe CTA; coming-soon add-ons don't —
          the top-right badge is enough signal. */}
      {!isComingSoon && !isActive && (
        <div className="mt-auto flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="default"
            disabled={isLoading}
            onClick={() => onSubscribe?.(addon.id)}
          >
            Subscribe
          </Button>
        </div>
      )}
    </div>
  )
}
