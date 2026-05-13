'use client'

import { useState } from 'react'
import { Inbox, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { UsageBar } from './usage-bar'
import { AddonCard } from './addon-card'
import { PlanSelectorModal } from './plan-selector-modal'
import { useSubscription, useAddons, useSubscribeAddon } from '@/hooks/billing'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

/**
 * Tab 1 — Usage & Plans. Top section shows renewal date + billing
 * cadence. Card grid below: Helpdesk (active) + 4 add-ons (all
 * coming-soon). Manage button opens the plan-selector modal.
 */
export function UsagePlansTab() {
  const { data: subResp, isLoading: subLoading }   = useSubscription()
  const { data: addons = [], isLoading: addonsLoading } = useAddons()
  const subscribeAddon = useSubscribeAddon()
  const [planSelectorOpen, setPlanSelectorOpen]    = useState(false)

  const sub   = subResp?.subscription
  const plan  = subResp?.plan
  const usage = subResp?.usage

  const isTrial = sub?.status === 'trial'
  const renewalDate = sub?.current_period_end

  if (subLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-48 w-full" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-44" />)}
        </div>
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

  return (
    <div className="flex flex-col gap-6">
      {/* Renewal banner */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-4 py-3">
        <div className="flex flex-col">
          <p className="text-sm">
            {isTrial && sub.trial_ends_at ? (
              <>Your trial ends on <span className="font-medium">{formatDate(sub.trial_ends_at)}</span>.</>
            ) : sub.cancel_at_period_end && renewalDate ? (
              <>Your subscription cancels on <span className="font-medium">{formatDate(renewalDate)}</span>.</>
            ) : renewalDate ? (
              <>Your subscription renews on <span className="font-medium">{formatDate(renewalDate)}</span>.</>
            ) : null}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">Billed monthly</span>
      </div>

      {/* Card grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Helpdesk card (current plan) */}
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Inbox size={20} strokeWidth={1.75} className="text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="text-[15px] font-semibold">Helpdesk</span>
                <span className="text-xs text-muted-foreground">{plan.display_name}</span>
              </div>
            </div>
            {isTrial
              ? <Badge variant="secondary">Trial</Badge>
              : sub.status === 'active'
                ? <Badge variant="default">Active</Badge>
                : <Badge variant="destructive">{sub.status}</Badge>}
          </div>

          <div className="flex flex-col gap-3">
            <UsageBar
              label="Tickets"
              used={usage?.tickets_used ?? 0}
              limit={plan.ticket_limit}
              pct={subResp.percentages.tickets}
            />
            <UsageBar
              label="AI Suggest"
              used={usage?.ai_suggest_used ?? 0}
              limit={plan.ai_suggest_limit}
              pct={subResp.percentages.ai_suggest}
            />
          </div>

          <div className="mt-auto flex items-end justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {plan.is_custom ? 'Custom pricing' : `€${Number(plan.price_eur).toFixed(0)}/month`}
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => setPlanSelectorOpen(true)}>
              Manage
            </Button>
          </div>
        </div>

        {/* Add-on cards */}
        {addonsLoading
          ? [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-44" />)
          : addons.map(addon => (
              <AddonCard
                key={addon.id}
                addon={addon}
                isLoading={subscribeAddon.isPending}
                onSubscribe={id => subscribeAddon.mutate(id)}
              />
            ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Questions about your plan? <a href="mailto:billing@lynqflow.co" className="underline">Contact us</a>.
      </p>

      <PlanSelectorModal open={planSelectorOpen} onOpenChange={setPlanSelectorOpen} />
    </div>
  )
}
