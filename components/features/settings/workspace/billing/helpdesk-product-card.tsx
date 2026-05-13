'use client'

import { Inbox, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Plan } from '@/types/billing'

interface HelpdeskProductCardProps {
  plans:             Plan[]
  currentPlanId:     string | null
  selectedPlanId:    string | null
  onSelectPlan:      (planId: string) => void
  isTrial:           boolean
  status:            string
  willCancel:        boolean
  onCancelToggle:    () => void
  cancelToggleBusy:  boolean
}

/**
 * Helpdesk row rendered inside the parent "Select Plans" card.
 *
 * Layout (two stacked lines, never wraps):
 *   Top:    [icon] Helpdesk [status badge] ........ Cancel auto-renewal
 *   Bottom: [{tickets} ▾] tickets/month  [(i) {currentPlan} ~~{currentTickets} tickets/month~~]
 *
 * The strikethrough comparison only appears when the user has chosen a
 * different plan in the dropdown (selectedPlanId !== currentPlanId).
 * No own background or border — the parent card provides those.
 */
export function HelpdeskProductCard({
  plans,
  currentPlanId,
  selectedPlanId,
  onSelectPlan,
  isTrial,
  status,
  willCancel,
  onCancelToggle,
  cancelToggleBusy,
}: HelpdeskProductCardProps) {
  const currentPlan      = plans.find(p => p.id === currentPlanId) ?? null
  const selectedPlan     = plans.find(p => p.id === selectedPlanId) ?? currentPlan
  const isCurrentCustom  = currentPlan?.is_custom ?? false
  const hasChange        = !!selectedPlan && !!currentPlan && selectedPlan.id !== currentPlan.id

  return (
    <div className="flex flex-col gap-3 px-6 py-5">
      {/* Top line: name + badge + cancel link */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Inbox size={18} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-semibold text-foreground">
            Helpdesk
          </span>
          {isTrial ? (
            <Badge variant="secondary" className="shrink-0">Trial</Badge>
          ) : status === 'active' ? (
            <Badge variant="success" className="shrink-0">Active</Badge>
          ) : (
            <Badge variant="destructive" className="shrink-0">{status}</Badge>
          )}
        </div>

        <button
          type="button"
          onClick={onCancelToggle}
          disabled={cancelToggleBusy}
          className="whitespace-nowrap text-sm font-medium text-[#EF4444] transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          {willCancel ? 'Reactivate subscription' : 'Cancel auto-renewal'}
        </button>
      </div>

      {/* Bottom line: dropdown + tickets/month label + optional current-plan strikethrough */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Select
          value={selectedPlanId ?? undefined}
          onValueChange={(value) => { if (value) onSelectPlan(value) }}
          disabled={isCurrentCustom}
        >
          <SelectTrigger
            size="sm"
            title={isCurrentCustom ? 'Elite plans are managed by sales' : undefined}
          >
            <SelectValue>
              <span className="whitespace-nowrap font-medium tabular-nums">
                {selectedPlan?.is_custom
                  ? 'Custom'
                  : selectedPlan?.ticket_limit?.toLocaleString() ?? '—'}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {plans.map(plan => (
              <SelectItem
                key={plan.id}
                value={plan.id}
                // Linear-neutral palette override (PR #30) — keep this
                // dropdown out of the brand-accent purple highlight.
                className="focus:!bg-[#F4F4F5] focus:!text-[#1C0F36] data-[highlighted]:!bg-[#F4F4F5] data-[highlighted]:!text-[#1C0F36] data-[selected]:!bg-[#E5E0EB] data-[selected]:!text-[#1C0F36]"
              >
                <span className="flex w-full items-baseline gap-2">
                  <span className="font-medium tabular-nums">
                    {plan.is_custom ? 'Custom' : plan.ticket_limit?.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">{plan.display_name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="whitespace-nowrap text-muted-foreground">tickets/month</span>

        {hasChange && currentPlan && (
          <span className="ml-1 flex items-center gap-1.5 whitespace-nowrap text-muted-foreground">
            <Info size={14} strokeWidth={1.75} />
            <span className="font-medium text-foreground">{currentPlan.display_name}</span>
            <span className="line-through">
              {currentPlan.is_custom
                ? 'Custom'
                : `${currentPlan.ticket_limit?.toLocaleString()} tickets/month`}
            </span>
          </span>
        )}
      </div>
    </div>
  )
}
