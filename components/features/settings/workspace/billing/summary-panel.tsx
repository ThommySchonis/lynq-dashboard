'use client'

import Link from 'next/link'
import { CreditCard } from 'lucide-react'
import type { Plan, PaymentMethod } from '@/types/billing'

interface SummaryPanelProps {
  selectedPlan:   Plan | null
  currentPlanId:  string | null
  isTrial:        boolean
  paymentMethod:  PaymentMethod | null
  isPending:      boolean
  onSubmit:       () => void
}

function paymentMethodLabel(pm: PaymentMethod | null): string {
  if (!pm) return 'No payment method on file'
  const brand = pm.brand ? pm.brand.charAt(0).toUpperCase() + pm.brand.slice(1) : 'Card'
  if (pm.last_four) return `${brand} ending in ${pm.last_four}`
  return brand
}

/**
 * Sticky right-rail summary panel for the billing redesign. Mirrors
 * the Gorgias plan-switcher layout: PRODUCT label + plan info, total,
 * payment method, and a single primary CTA. The CTA label and behavior
 * change based on plan state (already-on, custom/Elite, normal switch).
 */
export function SummaryPanel({
  selectedPlan,
  currentPlanId,
  isTrial,
  paymentMethod,
  isPending,
  onSubmit,
}: SummaryPanelProps) {
  const isSamePlan = selectedPlan != null && selectedPlan.id === currentPlanId
  const isCustom   = selectedPlan?.is_custom ?? false

  let ctaLabel = 'Update Subscription'
  let ctaDisabled = false
  if (!selectedPlan) {
    ctaLabel = 'Select a plan'
    ctaDisabled = true
  } else if (isSamePlan && !isTrial) {
    ctaLabel = 'Already on this plan'
    ctaDisabled = true
  } else if (isCustom) {
    ctaLabel = 'Contact Sales'
  } else if (isTrial) {
    ctaLabel = 'Upgrade Subscription'
  }
  if (isPending) ctaLabel = 'Processing…'

  return (
    <aside className="sticky top-6 flex w-full flex-col gap-5 self-start rounded-xl border border-border bg-card p-6">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Product
      </span>

      {selectedPlan ? (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-foreground">Helpdesk</span>
          <span className="text-xs text-muted-foreground">
            {selectedPlan.display_name}
            {!selectedPlan.is_custom && selectedPlan.ticket_limit != null && (
              <> · {selectedPlan.ticket_limit.toLocaleString()} tickets/month</>
            )}
          </span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Select a plan to see pricing.</p>
      )}

      <div className="flex items-center justify-between border-t border-border pt-4">
        <span className="text-sm font-medium text-foreground">Total</span>
        <span className="text-lg font-semibold tabular-nums text-foreground">
          {selectedPlan == null
            ? '—'
            : selectedPlan.is_custom
              ? 'Custom'
              : `€${Number(selectedPlan.price_eur).toFixed(0)}/month`}
        </span>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Payment method
        </span>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-foreground">
            <CreditCard size={14} strokeWidth={1.75} className="text-muted-foreground" />
            <span>{paymentMethodLabel(paymentMethod)}</span>
          </div>
          <Link
            href="/settings/workspace/billing?tab=payment"
            className="text-xs font-medium text-foreground underline-offset-2 hover:underline"
          >
            Change
          </Link>
        </div>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={ctaDisabled || isPending}
        className="mt-1 w-full rounded-md bg-[#1C0F36] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {ctaLabel}
      </button>

      {isCustom && (
        <p className="text-center text-[11px] text-muted-foreground">
          Elite plans require a sales contact.
        </p>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Prices exclusive of sales tax. Lynq &amp; Flow LLC is a US entity not registered
        for EU VAT — EU B2B customers receive reverse-charge invoices under Article 196.
      </p>
    </aside>
  )
}
