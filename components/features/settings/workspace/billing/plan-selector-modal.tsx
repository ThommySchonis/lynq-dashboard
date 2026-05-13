'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { PlanCard } from './plan-card'
import { usePlans, useSubscription, useChangePlan, useCancelSubscription, useReactivateSubscription } from '@/hooks/billing'
import type { Plan } from '@/types/billing'

interface PlanSelectorModalProps {
  open:        boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Plan-selector modal. Two-column layout matching the Gorgias reference:
 *   Left: list of plans (PlanCard each), clickable to select
 *   Right: summary panel showing price, upgrade-on-limit note, payment
 *          method, and the "Update Subscription" CTA
 *
 * Includes a "Cancel auto-renewal" link top-right (replaced with
 * "Reactivate" if the user already cancelled).
 */
export function PlanSelectorModal({ open, onOpenChange }: PlanSelectorModalProps) {
  const { data: plans = [] } = usePlans()
  const { data: subResp }    = useSubscription()
  const changePlan           = useChangePlan()
  const cancelSub            = useCancelSubscription()
  const reactivate           = useReactivateSubscription()

  const currentPlanId = subResp?.subscription?.plan_id ?? null
  const willCancel    = subResp?.subscription?.cancel_at_period_end ?? false

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(currentPlanId)
  useEffect(() => { if (open) setSelectedPlanId(currentPlanId) }, [open, currentPlanId])

  const selectedPlan: Plan | null =
    plans.find(p => p.id === selectedPlanId) ??
    plans.find(p => p.id === currentPlanId) ??
    null

  const isChanging   = selectedPlanId !== null && selectedPlanId !== currentPlanId
  const submitLabel  = !isChanging ? 'Already on this plan' : changePlan.isPending ? 'Updating…' : 'Update subscription'
  const submitDisabled = !isChanging || changePlan.isPending || selectedPlan?.is_custom

  async function handleSubmit() {
    if (!selectedPlanId || !isChanging) return
    changePlan.mutate(selectedPlanId, { onSuccess: () => onOpenChange(false) })
  }

  async function handleCancelToggle() {
    if (willCancel) reactivate.mutate()
    else            cancelSub.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle>Manage subscription</DialogTitle>
              <DialogDescription>
                Switch plans, update auto-renewal, or contact sales for the Elite tier.
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={handleCancelToggle}
              disabled={cancelSub.isPending || reactivate.isPending}
              className="text-xs underline-offset-2 hover:underline text-muted-foreground hover:text-foreground transition-colors"
            >
              {willCancel ? 'Reactivate subscription' : 'Cancel auto-renewal'}
            </button>
          </div>
        </DialogHeader>

        <div className="grid gap-6 sm:grid-cols-[2fr_1fr]">
          {/* Left — plan list */}
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Select plan
            </p>
            <div className="flex flex-col gap-2.5">
              {plans.map(plan => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isActive={plan.id === currentPlanId}
                  selectable={!plan.is_custom}
                  onSelect={setSelectedPlanId}
                  className={selectedPlanId === plan.id && plan.id !== currentPlanId ? 'border-primary ring-1 ring-primary/40' : ''}
                />
              ))}
            </div>
          </div>

          {/* Right — summary */}
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-secondary/40 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Summary
            </p>

            {selectedPlan ? (
              <>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Product</span>
                  <span className="text-sm font-medium">{selectedPlan.display_name}</span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Price</span>
                  <span className="text-lg font-semibold tabular-nums">
                    {selectedPlan.is_custom
                      ? 'Custom'
                      : `€${Number(selectedPlan.price_eur).toFixed(2)} / month`}
                  </span>
                </div>

                {!selectedPlan.is_custom && (
                  <div className="flex flex-col gap-1.5 rounded-lg bg-background p-3 text-xs">
                    <p className="text-muted-foreground">
                      When you reach your plan limit, we&apos;ll prompt you to upgrade.
                      Your current plan stays active until you switch.
                    </p>
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground">
                  Prices exclusive of sales tax. Lynq &amp; Flow LLC is a US entity not registered
                  for EU VAT — EU B2B customers receive reverse-charge invoices under Article 196.
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Select a plan to see pricing.</p>
            )}

            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitDisabled}
              className="mt-auto w-full"
            >
              {submitLabel}
            </Button>

            {selectedPlan?.is_custom && (
              <p className="text-[11px] text-center text-muted-foreground">
                Elite plans require a sales contact — email{' '}
                <a href="mailto:billing@lynqflow.co" className="underline">
                  billing@lynqflow.co
                </a>
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
