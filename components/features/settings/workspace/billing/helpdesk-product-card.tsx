'use client'

import { Inbox } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UsageBar } from './usage-bar'
import type { Plan, UsageCounter } from '@/types/billing'

interface HelpdeskProductCardProps {
  plans:             Plan[]
  currentPlanId:     string | null
  selectedPlanId:    string | null
  onSelectPlan:      (planId: string) => void
  isTrial:           boolean
  status:            string
  usage:             UsageCounter | null
  percentages:       { tickets: number; ai_suggest: number }
  willCancel:        boolean
  onCancelToggle:    () => void
  cancelToggleBusy:  boolean
}

export function HelpdeskProductCard({
  plans,
  currentPlanId,
  selectedPlanId,
  onSelectPlan,
  isTrial,
  status,
  usage,
  percentages,
  willCancel,
  onCancelToggle,
  cancelToggleBusy,
}: HelpdeskProductCardProps) {
  const currentPlan      = plans.find(p => p.id === currentPlanId) ?? null
  const isCurrentCustom  = currentPlan?.is_custom ?? false
  const selectedForLabel = plans.find(p => p.id === selectedPlanId) ?? currentPlan

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-foreground/5">
            <Inbox size={20} strokeWidth={1.75} className="text-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold text-foreground">Helpdesk</span>
            <span className="text-xs text-muted-foreground">
              {currentPlan?.display_name ?? 'No plan'}
            </span>
          </div>
        </div>
        {isTrial
          ? <Badge variant="secondary">Trial</Badge>
          : status === 'active'
            ? <Badge variant="default">Active</Badge>
            : <Badge variant="destructive">{status}</Badge>}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Plan tier
        </label>
        <Select
          value={selectedPlanId ?? undefined}
          onValueChange={(value) => { if (value) onSelectPlan(value) }}
          disabled={isCurrentCustom}
        >
          <SelectTrigger
            className="w-full justify-between"
            title={isCurrentCustom ? 'Elite plans are managed by sales' : undefined}
          >
            <SelectValue>
              {selectedForLabel ? (
                <span className="flex items-center gap-2">
                  <span className="font-medium">{selectedForLabel.display_name}</span>
                  <span className="text-muted-foreground">
                    {selectedForLabel.is_custom
                      ? 'Custom pricing'
                      : `€${Number(selectedForLabel.price_eur).toFixed(0)}/month`}
                  </span>
                </span>
              ) : (
                'Select a plan'
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {plans.map(plan => (
              <SelectItem
                key={plan.id}
                value={plan.id}
                // Tone down the dropdown highlight to a Linear-style neutral
                // — the default shadcn `focus:bg-accent` is too purple for
                // the brand strip. Highlighted = #F4F4F5, selected = #E5E0EB,
                // text stays cosmic-ink (#1C0F36) in all states.
                className="focus:!bg-[#F4F4F5] focus:!text-[#1C0F36] data-[highlighted]:!bg-[#F4F4F5] data-[highlighted]:!text-[#1C0F36] data-[selected]:!bg-[#E5E0EB] data-[selected]:!text-[#1C0F36]"
              >
                <span className="flex w-full items-center justify-between gap-4">
                  <span className="font-medium">{plan.display_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {plan.is_custom
                      ? 'Custom'
                      : `${plan.ticket_limit?.toLocaleString()} tickets · €${Number(plan.price_eur).toFixed(0)}/mo`}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isCurrentCustom && (
          <p className="text-xs text-muted-foreground">
            Elite plans are managed by our sales team.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <UsageBar
          label="Tickets"
          used={usage?.tickets_used ?? 0}
          limit={currentPlan?.ticket_limit ?? null}
          pct={percentages.tickets}
        />
        <UsageBar
          label="AI Suggest"
          used={usage?.ai_suggest_used ?? 0}
          limit={currentPlan?.ai_suggest_limit ?? null}
          pct={percentages.ai_suggest}
        />
      </div>

      <div className="flex items-center justify-end border-t border-border pt-4">
        <button
          type="button"
          onClick={onCancelToggle}
          disabled={cancelToggleBusy}
          className="text-xs font-medium text-[#EF4444] underline-offset-2 transition-colors hover:underline disabled:opacity-50"
        >
          {willCancel ? 'Reactivate subscription' : 'Cancel auto-renewal'}
        </button>
      </div>
    </div>
  )
}
