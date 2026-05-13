'use client'

import { useState, useEffect, useMemo } from 'react'
import { AlertCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { AddonRow } from './addon-row'
import { HelpdeskProductCard } from './helpdesk-product-card'
import { SummaryPanel } from './summary-panel'
import {
  useSubscription,
  useAddons,
  usePlans,
  usePaymentMethods,
  useChangePlan,
  useCancelSubscription,
  useReactivateSubscription,
} from '@/hooks/billing'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const SALES_MAILTO = 'mailto:billing@lynqflow.co?subject=Elite%20plan%20inquiry'

/**
 * Usage & Plans tab — split layout matching the Gorgias reference:
 *
 *   Left  : single "Select Plans" card with the Helpdesk row stacked
 *           on top of the four add-on rows. Internal dividers via
 *           `divide-y` — no per-row border or background.
 *   Right : sticky Summary panel with Product/Price headers, Upgraded
 *           badge + strikethrough old price when a pending change
 *           exists, Total row, payment method, and the dark
 *           Update Subscription CTA.
 */
export function UsagePlansTab() {
  const { data: subResp,        isLoading: subLoading    } = useSubscription()
  const { data: plans = [],     isLoading: plansLoading  } = usePlans()
  const { data: addons = [],    isLoading: addonsLoading } = useAddons()
  const { data: paymentMethods = [] }                      = usePaymentMethods()

  const changePlan = useChangePlan()
  const cancelSub  = useCancelSubscription()
  const reactivate = useReactivateSubscription()

  const sub  = subResp?.subscription ?? null
  const plan = subResp?.plan         ?? null

  const isTrial       = sub?.status === 'trial'
  const renewalDate   = sub?.current_period_end ?? null
  const currentPlanId = sub?.plan_id ?? null
  const willCancel    = sub?.cancel_at_period_end ?? false

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(currentPlanId)
  useEffect(() => { setSelectedPlanId(currentPlanId) }, [currentPlanId])

  const selectedPlan = useMemo(
    () => plans.find(p => p.id === selectedPlanId) ?? plan ?? null,
    [plans, selectedPlanId, plan],
  )

  const defaultPaymentMethod = paymentMethods.find(m => m.is_default) ?? paymentMethods[0] ?? null

  if (subLoading || plansLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-[420px] w-full" />
        </div>
        <Skeleton className="h-[480px] w-full self-start" />
      </div>
    )
  }

  if (!sub || !plan) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <AlertCircle size={24} className="mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium">No active subscription</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Contact <a href="mailto:billing@lynqflow.co" className="underline">billing@lynqflow.co</a> to get started.
        </p>
      </div>
    )
  }

  function handleCancelToggle() {
    if (willCancel) reactivate.mutate()
    else            cancelSub.mutate()
  }

  function handleSubmit() {
    if (!selectedPlan) return
    if (selectedPlan.is_custom) {
      if (typeof window !== 'undefined') window.location.href = SALES_MAILTO
      return
    }
    if (selectedPlan.id === currentPlanId && !isTrial) return
    changePlan.mutate({ planId: selectedPlan.id, openInNewTab: true })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* ── Left rail ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6">
        {/* Renewal banner */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-4 py-3">
          <p className="text-sm">
            {isTrial && sub.trial_ends_at ? (
              <>Your trial ends on <span className="font-medium">{formatDate(sub.trial_ends_at)}</span>.</>
            ) : sub.cancel_at_period_end && renewalDate ? (
              <>Your subscription cancels on <span className="font-medium">{formatDate(renewalDate)}</span>.</>
            ) : renewalDate ? (
              <>Your subscription renews on <span className="font-medium">{formatDate(renewalDate)}</span>.</>
            ) : null}
          </p>
          <span className="text-xs text-muted-foreground">Billed monthly</span>
        </div>

        {/* Select Plans card — single card, divide-y between rows */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <header className="px-6 py-5">
            <h2 className="text-lg font-semibold text-foreground">Select Plans</h2>
          </header>

          <div className="divide-y divide-border border-t border-border">
            <HelpdeskProductCard
              plans={plans}
              currentPlanId={currentPlanId}
              selectedPlanId={selectedPlanId}
              onSelectPlan={setSelectedPlanId}
              isTrial={isTrial}
              status={sub.status}
              willCancel={willCancel}
              onCancelToggle={handleCancelToggle}
              cancelToggleBusy={cancelSub.isPending || reactivate.isPending}
            />

            {addonsLoading
              ? [1, 2, 3, 4].map(i => (
                  <div key={i} className="px-6 py-4">
                    <Skeleton className="h-6 w-full" />
                  </div>
                ))
              : addons.map(addon => (
                  <AddonRow key={addon.id} addon={addon} />
                ))}
          </div>
        </section>
      </div>

      {/* ── Right rail (sticky summary) ───────────────────────────── */}
      <SummaryPanel
        currentPlan={plan}
        selectedPlan={selectedPlan}
        isTrial={isTrial}
        paymentMethod={defaultPaymentMethod}
        isPending={changePlan.isPending}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
