'use client'

import { Zap, Phone, MessageSquare, MessageCircle, Lock } from 'lucide-react'
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
 * Add-on card — renders Emma / Voice / SMS / Convert with their
 * `coming_soon` state. Subscribe button is disabled with a tooltip
 * for `coming_soon` add-ons.
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
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold text-foreground">{addon.display_name}</span>
            {addon.description && (
              <span className="text-xs text-muted-foreground">{addon.description}</span>
            )}
          </div>
        </div>
        {isComingSoon && <Badge variant="secondary">Coming Soon</Badge>}
        {isActive && !isComingSoon && <Badge variant="default">Active</Badge>}
      </div>

      <div className="mt-auto flex items-end justify-between gap-3">
        {priceLabel && (
          <span className="text-xs text-muted-foreground">{priceLabel}</span>
        )}
        <Button
          type="button"
          size="sm"
          variant={isComingSoon ? 'outline' : 'default'}
          disabled={isComingSoon || isActive || isLoading}
          onClick={() => onSubscribe?.(addon.id)}
          title={isComingSoon ? 'Coming soon — not yet available' : undefined}
        >
          {isComingSoon && <Lock size={14} />}
          {isActive ? 'Subscribed' : isComingSoon ? 'Coming Soon' : 'Subscribe'}
        </Button>
      </div>
    </div>
  )
}
