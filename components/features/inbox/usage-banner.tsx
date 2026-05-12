'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUsage } from '@/hooks/billing'

const OVERAGE_TICKET_EUR = 0.20
const OVERAGE_AI_EUR     = 0.10

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

  const overageTickets = usage.tickets_overage
  const overageAI      = usage.ai_suggest_overage
  const overageCost    = overageTickets * OVERAGE_TICKET_EUR + overageAI * OVERAGE_AI_EUR

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
              {ticketsPct  >= 100 && <>Tickets: {usage.tickets_used.toLocaleString()} / {usage.tickets_limit?.toLocaleString()} · </>}
              {aiPct       >= 100 && <>AI Suggest: {usage.ai_suggest_used.toLocaleString()} / {usage.ai_suggest_limit?.toLocaleString()} · </>}
              Continued usage is billed at €{OVERAGE_TICKET_EUR.toFixed(2)}/ticket and €{OVERAGE_AI_EUR.toFixed(2)}/AI Suggest.
              {(overageTickets > 0 || overageAI > 0) && (
                <span className="ml-1 font-medium">
                  Current overage: €{overageCost.toFixed(2)}.
                </span>
              )}
            </span>
          ) : (
            <span>
              <span className="font-semibold">You&apos;re approaching your plan limit.</span>{' '}
              Tickets: {ticketsPct}% · AI Suggest: {aiPct}%. Consider upgrading before overage rates kick in.
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
