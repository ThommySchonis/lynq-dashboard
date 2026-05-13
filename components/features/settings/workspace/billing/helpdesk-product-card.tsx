'use client'

import { Inbox } from 'lucide-react'
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
 * Helpdesk row — visually identical to AddonRow on the left side
 * (icon tile + name + status badge) and adds the plan-tier dropdown
 * + Cancel/Reactivate link on the right. Dropdown trigger shows the
 * plan name only; the full label (price + tickets) lives in the
 * Summary panel to avoid redundancy.
 *
 * Same dimensions as AddonRow: min-h-14, py-[14px] px-5,
 * rounded-[10px], white bg with 0.5px #E5E0EB border. Everything
 * stays on a single line via whitespace-nowrap + shrink-0 / min-w-0.
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
  const isCurrentCustom  = currentPlan?.is_custom ?? false
  const selectedForLabel = plans.find(p => p.id === selectedPlanId) ?? currentPlan

  return (
    <div className="flex min-h-14 items-center justify-between gap-4 rounded-[10px] border-[0.5px] border-[#E5E0EB] bg-white px-5 py-[14px]">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#F4F4F5]">
          <Inbox size={16} strokeWidth={1.75} className="text-foreground/70" />
        </div>
        <span className="truncate text-sm font-medium text-foreground">
          Helpdesk
        </span>
        {isTrial ? (
          <Badge variant="secondary" className="shrink-0">Trial</Badge>
        ) : status === 'active' ? (
          <Badge variant="default" className="shrink-0">Active</Badge>
        ) : (
          <Badge variant="destructive" className="shrink-0">{status}</Badge>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <Select
          value={selectedPlanId ?? undefined}
          onValueChange={(value) => { if (value) onSelectPlan(value) }}
          disabled={isCurrentCustom}
        >
          <SelectTrigger title={isCurrentCustom ? 'Elite plans are managed by sales' : undefined}>
            <SelectValue>
              <span className="whitespace-nowrap font-medium">
                {selectedForLabel?.display_name ?? 'Select'}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {plans.map(plan => (
              <SelectItem
                key={plan.id}
                value={plan.id}
                // Linear-neutral palette override (see PR #30) — overrides
                // the shadcn focus:bg-accent purple highlight at this
                // call-site only.
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

        <button
          type="button"
          onClick={onCancelToggle}
          disabled={cancelToggleBusy}
          className="whitespace-nowrap text-xs font-medium text-[#EF4444] underline-offset-2 transition-colors hover:underline disabled:opacity-50"
        >
          {willCancel ? 'Reactivate subscription' : 'Cancel auto-renewal'}
        </button>
      </div>
    </div>
  )
}
