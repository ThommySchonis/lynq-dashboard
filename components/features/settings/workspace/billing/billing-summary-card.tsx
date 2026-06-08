'use client'
import { useState } from 'react'
import { useSubscription, useManageUrl, useBillingStores } from '@/hooks/billing/use-billing-data'
import { useSyncBilling } from '@/hooks/billing/use-billing-mutations'
import { BillingStorePickerModal } from './billing-store-picker-modal'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function BillingSummaryCard() {
  const subQ = useSubscription()
  const manageQ = useManageUrl()
  const storesQ = useBillingStores()
  const syncM = useSyncBilling()
  const [pickerOpen, setPickerOpen] = useState(false)

  if (subQ.isLoading) return <div className="rounded-lg border border-border bg-card p-6">Loading…</div>
  if (subQ.isError || !subQ.data) {
    return <div className="rounded-lg border border-border bg-card p-6 text-destructive">Failed to load subscription.</div>
  }

  const { subscription, plan } = subQ.data
  const billingStore = storesQ.data?.find((s) => s.isBillingStore)
  const trialing = subscription.status === 'trial' || (subscription.trialEndsAt !== null && new Date(subscription.trialEndsAt) > new Date())

  return (
    <>
      <section className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-base font-medium">Subscription</h2>

        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-[140px_1fr]">
          <dt className="text-muted-foreground">Plan</dt>
          <dd>{plan?.display_name ?? '—'}</dd>

          <dt className="text-muted-foreground">Status</dt>
          <dd className="capitalize">{subscription.status.replace(/_/g, ' ')}</dd>

          {trialing && (
            <>
              <dt className="text-muted-foreground">Trial ends</dt>
              <dd>{fmtDate(subscription.trialEndsAt)}</dd>
            </>
          )}

          <dt className="text-muted-foreground">Next renewal</dt>
          <dd>{fmtDate(subscription.currentPeriodEnd)}</dd>

          <dt className="text-muted-foreground">Billing store</dt>
          <dd className="flex items-center gap-2">
            <span>{billingStore?.shopifyDomain ?? '—'}</span>
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => setPickerOpen(true)}
            >
              Change
            </button>
          </dd>
        </dl>

        <div className="flex flex-wrap gap-3 pt-2">
          {manageQ.data && (
            <a
              href={manageQ.data}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Manage subscription in Shopify ↗
            </a>
          )}
          <button
            type="button"
            onClick={() => syncM.mutate()}
            disabled={syncM.isPending}
            className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            {syncM.isPending ? 'Refreshing…' : 'Refresh from Shopify'}
          </button>
        </div>
      </section>

      <BillingStorePickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </>
  )
}
