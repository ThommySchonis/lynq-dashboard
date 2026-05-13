'use client'

import { useState, useEffect, useMemo } from 'react'
import { AlertCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { AddonCard } from './addon-card'
import { HelpdeskProductCard } from './helpdesk-product-card'
import { SummaryPanel } from './summary-panel'
import {
  useSubscription,
  useAddons,
  usePlans,
  usePaymentMethods,
  useSubscribeAddon,
  useChangePlan,
  useCancelSubscription,
  useReactivateSubscription,
} from '@/hooks/billing'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const SALES_MAILTO = 'mailto:billing@lynqflow.co?subject=Elite%20plan%20inquiry'

/**
 * Tab 1 — Usage & Plans. Two-column split layout (Gorgias-style):
 *   Left rail  : renewal banner, Helpdesk product card with plan-tier
 *                dropdown, four coming-soon add-ons.
 *   Right rail : sticky summary panel — selected plan, total, payment
 *                method, primary CTA. Replaces the old modal flow.
 */
export function UsagePlansTab() {
  const { data: subResp,        isLoading: subLoading     } = useSubscription()
  const { data: plans = [],     isLoading: plansLoading   } = usePlans()
  const { data: addons = [],    isLoading: addonsLoading  } = useAddons()
  const { data: paymentMethods = [] }                       = usePaymentMethods()

  const changePlan = useChangePlan()
  const cancelSub  = useCancelSubscription()
  const reactivate = useReactivateSubscription()
  const subAddon   = useSubscribeAddon()

  const sub          = subResp?.subscription ?? null
  const plan         = subResp?.plan         ?? null
  const usage        = subResp?.usage        ?? null
  const percentages  = subResp?.percentages  ?? { tickets: 0, ai_suggest: 0 }

  const isTrial      = sub?.status === 'trial'
  const renewalDate  = sub?.current_period_end ?? null
  const currentPlanId = sub?.plan_id ?? null
  const willCancel   = sub?.cancel_at_period_end ?? false

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(currentPlanId)
  useEffect(() => { setSelectedPlanId(currentPlanId) }, [currentPlanId])

  const selectedPlan = useMemo(
    () => plans.find(p => p.id === selectedPlanId) ?? plan ?? null,
    [plans, selectedPlanId, plan],
  )

  const defaultPaymentMethod = paymentMethods.find(m => m.is_default) ?? paymentMethods[0] ?? null

  if (subLoading || plansLoading) {
    return (
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-44" />)}
          </div>
        </div>
        <Skeleton className="h-80 w-full" />
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
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      {/* ── Left rail ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-5">
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

        {/* Helpdesk product card */}
        <HelpdeskProductCard
          plans={plans}
          currentPlanId={currentPlanId}
          selectedPlanId={selectedPlanId}
          onSelectPlan={setSelectedPlanId}
          isTrial={isTrial}
          status={sub.status}
          usage={usage}
          percentages={percentages}
          willCancel={willCancel}
          onCancelToggle={handleCancelToggle}
          cancelToggleBusy={cancelSub.isPending || reactivate.isPending}
        />

        {/* Add-ons */}
        <div className="grid gap-4 sm:grid-cols-2">
          {addonsLoading
            ? [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-44" />)
            : addons.map(addon => (
                <AddonCard
                  key={addon.id}
                  addon={addon}
                  isLoading={subAddon.isPending}
                  onSubscribe={id => subAddon.mutate(id)}
                />
              ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Questions about your plan? <a href="mailto:billing@lynqflow.co" className="underline">Contact us</a>.
        </p>
      </div>

      {/* ── Right rail (sticky summary) ───────────────────────────── */}
      <SummaryPanel
        selectedPlan={selectedPlan}
        currentPlanId={currentPlanId}
        isTrial={isTrial}
        paymentMethod={defaultPaymentMethod}
        isPending={changePlan.isPending}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
