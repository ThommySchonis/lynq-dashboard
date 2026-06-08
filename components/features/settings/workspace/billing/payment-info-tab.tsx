'use client'
import { useBillingInfo, useManageUrl } from '@/hooks/billing/use-billing-data'

export function PaymentInfoTab() {
  const infoQ = useBillingInfo()
  const manageQ = useManageUrl()

  if (infoQ.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (infoQ.isError || !infoQ.data) {
    return <p className="text-sm text-muted-foreground">No billing address found in Shopify.</p>
  }

  const a = infoQ.data
  const lines = [
    a.company,
    a.address1,
    a.address2,
    [a.zip, a.city].filter(Boolean).join(' '),
    a.province,
    a.country,
  ].filter(Boolean)

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Your billing address is managed in Shopify.
      </p>
      <div className="rounded-lg border border-border bg-card p-6">
        {lines.map((l, i) => <p key={i} className="text-sm">{l}</p>)}
      </div>
      {manageQ.data && (
        <a
          href={manageQ.data}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-sm text-primary hover:underline"
        >
          Edit billing address in Shopify ↗
        </a>
      )}
    </div>
  )
}
