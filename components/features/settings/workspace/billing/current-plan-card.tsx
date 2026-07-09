'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useSubscription, useOpenManageUrl, useCancelSubscription } from '@/hooks/billing/use-billing-data'
import { formatBillingDate } from '@/lib/billing-format'
import type { ShopifySubscriptionStatus } from '@/types/billing'
import { StatusPill, type StatusTone } from './status-pill'
import { CancelSubscriptionDialog } from './cancel-subscription-dialog'

const STATUS_META: Record<ShopifySubscriptionStatus, { label: string; tone: StatusTone }> = {
  active:                        { label: 'Active',   tone: 'success' },
  trial:                         { label: 'Trial',    tone: 'info' },
  past_due:                      { label: 'Past due', tone: 'warning' },
  canceled:                      { label: 'Canceled', tone: 'destructive' },
  paused:                        { label: 'Paused',   tone: 'neutral' },
  pending_shopify_subscription:  { label: 'Pending',  tone: 'neutral' },
}

const SHELL = 'rounded-[18px] border border-settings-border bg-card p-6'

export function CurrentPlanCard() {
  const subQ = useSubscription()
  const { openManage, ready } = useOpenManageUrl()
  const [cancelOpen, setCancelOpen] = useState(false)
  const cancelMut = useCancelSubscription()

  if (subQ.isLoading) {
    return <div className={`${SHELL} text-sm text-muted-foreground`}>Loading subscription…</div>
  }
  if (subQ.isError || !subQ.data) {
    return <div className={`${SHELL} text-sm text-destructive`}>Failed to load subscription.</div>
  }

  const { subscription, plan, usage } = subQ.data
  const status = STATUS_META[subscription.status] ?? { label: subscription.status, tone: 'neutral' as StatusTone }
  const trialing =
    subscription.status === 'trial' ||
    (subscription.trialEndsAt !== null && new Date(subscription.trialEndsAt) > new Date())

  const renewLine = trialing
    ? `Trial ends ${formatBillingDate(subscription.trialEndsAt)}`
    : `Renews ${formatBillingDate(subscription.currentPeriodEnd)}`

  const used = usage?.ai_suggest_used ?? 0
  const limit = plan?.ai_suggest_limit ?? null
  const pct = limit && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0

  // Cancel goes through Shopify, so it only applies to subscriptions with a live
  // Shopify charge. Grandfathered plans were provisioned without one — there's
  // nothing to cancel, and the backend correctly rejects it (no_active_subscription).
  const canCancel =
    subscription.status !== 'canceled' &&
    subscription.status !== 'pending_shopify_subscription' &&
    !subscription.isGrandfathered

  return (
    <>
      <div className={`${SHELL} flex items-start justify-between gap-6`}>
        <div className="flex min-w-0 flex-col">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground-4">Current plan</span>

          <div className="mt-[9px] flex items-center gap-2.5">
            <span className="text-xl font-bold leading-tight text-foreground">{plan?.display_name ?? '—'}</span>
            <StatusPill label={status.label} tone={status.tone} />
          </div>

          <p className="mt-1.5 text-sm font-medium text-foreground-3">{renewLine}</p>

          <div className="mt-5 flex w-[400px] max-w-full flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground-2">AI agent messages this cycle</span>
              <span className="text-xs font-medium text-foreground-3">
                {used}{limit !== null && ` / ${limit}`}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/[0.08]">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-3">
          <Button onClick={openManage} disabled={!ready}>Change plan</Button>
          {canCancel && (
            <button
              type="button"
              onClick={() => setCancelOpen(true)}
              className="text-xs font-medium text-foreground-3 transition-colors hover:text-foreground"
            >
              Cancel subscription
            </button>
          )}
          {subscription.isGrandfathered && (
            <p className="max-w-[200px] text-right text-xs font-medium text-foreground-4">
              This plan isn&apos;t billed through Shopify. Contact support to change it.
            </p>
          )}
        </div>
      </div>
      <CancelSubscriptionDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        loading={cancelMut.isPending}
        onConfirm={() =>
          cancelMut.mutate(undefined, { onSuccess: () => setCancelOpen(false) })
        }
      />
    </>
  )
}
