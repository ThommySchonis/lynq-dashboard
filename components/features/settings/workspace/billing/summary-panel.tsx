'use client'

import Link from 'next/link'
import { CreditCard } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Plan, PaymentMethod } from '@/types/billing'

interface SummaryPanelProps {
  currentPlan:   Plan | null
  selectedPlan:  Plan | null
  isTrial:       boolean
  paymentMethod: PaymentMethod | null
  isPending:     boolean
  onSubmit:      () => void
}

function paymentMethodLabel(pm: PaymentMethod | null): string {
  if (!pm) return 'No payment method on file'
  const brand = pm.brand ? pm.brand.charAt(0).toUpperCase() + pm.brand.slice(1) : 'Card'
  if (pm.last_four) return `${brand} ending with ${pm.last_four}`
  return brand
}

function priceLabel(plan: Plan | null): string {
  if (!plan) return '—'
  if (plan.is_custom) return 'Custom'
  return `€${Number(plan.price_eur).toFixed(0)}/month`
}

/**
 * Right-rail Summary panel — sticky over the full left column height.
 * Mirrors the Gorgias plan-switcher: PRODUCT/PRICE column headers,
 * Helpdesk row with "Upgraded" badge + strikethrough old price when a
 * change is pending, Total row, payment method, disclaimer, and the
 * primary Update Subscription CTA in Cosmic Ink (#1C0F36).
 */
export function SummaryPanel({
  currentPlan,
  selectedPlan,
  isTrial,
  paymentMethod,
  isPending,
  onSubmit,
}: SummaryPanelProps) {
  const hasChange  = !!selectedPlan && !!currentPlan && selectedPlan.id !== currentPlan.id
  const isSamePlan = !!selectedPlan && selectedPlan.id === currentPlan?.id
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
    <aside className="sticky top-6 flex w-full flex-col self-start overflow-hidden rounded-2xl border border-border bg-card">
      <div className="px-6 py-5">
        <h2 className="text-lg font-semibold text-foreground">Summary</h2>
      </div>

      <div className="flex items-center justify-between border-t border-border px-6 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Product</span>
        <span>Price</span>
      </div>

      <div className="flex items-start justify-between gap-4 px-6 py-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Helpdesk</span>
            {hasChange && <Badge variant="secondary">Upgraded</Badge>}
          </div>
          {selectedPlan && (
            <span className="text-xs text-muted-foreground">
              {selectedPlan.display_name}
              {!selectedPlan.is_custom && selectedPlan.ticket_limit != null && (
                <> &mdash; {selectedPlan.ticket_limit.toLocaleString()} tickets/month</>
              )}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2 whitespace-nowrap">
          {hasChange && currentPlan && !currentPlan.is_custom && (
            <span className="text-sm text-muted-foreground line-through">
              €{Number(currentPlan.price_eur).toFixed(0)}
            </span>
          )}
          <span className="text-sm font-medium text-foreground">{priceLabel(selectedPlan)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border px-6 py-4">
        <span className="text-sm font-medium text-foreground">Total</span>
        <div className="flex items-baseline gap-2 whitespace-nowrap">
          {hasChange && currentPlan && !currentPlan.is_custom && (
            <span className="text-sm text-muted-foreground line-through">
              €{Number(currentPlan.price_eur).toFixed(0)}
            </span>
          )}
          <span className="text-base font-semibold text-foreground">{priceLabel(selectedPlan)}</span>
        </div>
      </div>

      <p className="px-6 pb-4 text-right text-[11px] text-muted-foreground">
        Prices exclusive of sales tax
      </p>

      <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <CreditCard size={16} strokeWidth={1.75} className="text-muted-foreground" />
          <span>{paymentMethodLabel(paymentMethod)}</span>
        </div>
        <Link
          href="/settings/workspace/billing?tab=payment"
          className="whitespace-nowrap text-xs font-medium text-foreground underline-offset-2 hover:underline"
        >
          Change Payment Method
        </Link>
      </div>

      <div className="flex flex-col gap-4 border-t border-border px-6 py-5">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          You agree to be charged in accordance with the subscription plan until you cancel. Previous
          charges won&apos;t be refunded when you cancel unless legally required. Payment data is
          encrypted. Lynq &amp; Flow LLC is a US entity not registered for EU VAT — EU B2B customers
          receive reverse-charge invoices under Article 196.
        </p>
        <button
          type="button"
          onClick={onSubmit}
          disabled={ctaDisabled || isPending}
          className="self-end rounded-md bg-[#1C0F36] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {ctaLabel}
        </button>
      </div>
    </aside>
  )
}
