'use client'

import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSubscription } from '@/hooks/billing'

interface PlanBadgeProps {
  collapsed?: boolean
}

/**
 * Current-plan pill in the footer (Figma 776-17279). Links to billing.
 * Hidden when collapsed. Defaults to "Free" until subscription data loads.
 */
export function PlanBadge({ collapsed }: PlanBadgeProps) {
  const { data } = useSubscription()

  if (collapsed) return null

  const planName = data?.plan?.display_name ?? 'Free'

  return (
    <Link
      href="/settings/workspace/billing"
      className={cn(
        'flex items-center gap-2 rounded-lg border border-accent-border bg-accent-soft px-3 py-2',
        'text-sm font-medium text-primary transition-colors hover:bg-accent-soft/70',
      )}
    >
      <Sparkles className="size-4 shrink-0" />
      <span className="truncate">{planName}</span>
    </Link>
  )
}
