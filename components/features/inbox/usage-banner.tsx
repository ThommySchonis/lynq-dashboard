'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUsage } from '@/hooks/billing'

/**
 * Workspace usage banner shown above the inbox when the workspace
 * crosses the 80% or 100% threshold on either tickets or AI Suggest.
 *
 * Colors:
 *   - 80-99% on either counter  → amber, "approaching limit"
 *   - 100%+ on either counter   → red,   "limit reached" + upgrade CTA
 *
 * Banners can be dismissed locally (sessionStorage) to avoid annoyance,
 * but they reappear on next session since the underlying condition
 * persists until the period rolls over.
 *
 * Model 3 (forced upgrade) — no overage charging. The 100%+ banner
 * directs the customer to upgrade; the backend blocks further usage
 * once the limit is reached. See docs/billing-model.md.
 */
export function InboxUsageBanner() {
  const { data: usage } = useUsage()
  const [dismissed, setDismissed] = useState<'80' | '100' | null>(
    typeof window !== 'undefined' ? (sessionStorage.getItem('usage-banner-dismissed') as '80' | '100' | null) : null,
  )

  if (!usage) return null

  const ticketsPct    = usage.percentages.tickets
  const aiPct         = usage.percentages.ai_suggest
  const maxPct        = Math.max(ticketsPct, aiPct)

  // Nothing to show
  if (maxPct < 80) return null

  const level: '80' | '100' = maxPct >= 100 ? '100' : '80'

  // Respect dismissal at the SAME level. A higher level (100 after
  // dismissing 80) always re-shows.
  if (dismissed === '100') return null
  if (dismissed === '80' && level === '80') return null

  function dismiss() {
    if (typeof window !== 'undefined') sessionStorage.setItem('usage-banner-dismissed', level)
    setDismissed(level)
  }

  const isLimitReached = level === '100'

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed top-0 right-0 left-0 z-50 border-b px-4 py-2.5 text-sm shadow-sm',
        isLimitReached
          ? 'bg-destructive/10 border-destructive/30 text-destructive-foreground'
          : 'bg-amber-100 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100',
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <AlertTriangle size={16} strokeWidth={2} />

          {isLimitReached ? (
            <span>
              <span className="font-semibold">Plan limit reached.</span>{' '}
              Upgrade your plan to keep handling tickets without interruption.
            </span>
          ) : (
            <span>
              <span className="font-semibold">You&apos;re approaching your plan limit.</span>{' '}
              Consider upgrading.
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/settings/workspace/billing"
            className={cn(
              'rounded-md px-3 py-1 text-xs font-semibold underline-offset-2 hover:underline',
              isLimitReached ? 'text-destructive' : 'text-amber-900 dark:text-amber-100',
            )}
          >
            {isLimitReached ? 'Upgrade plan' : 'View plans'}
          </Link>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss banner"
            className="rounded-md p-1 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  )
}
