'use client'

import { useSubscription, useManageUrl } from '@/hooks/billing/use-billing-data'

const SUSPENDED_STATUSES = new Set(['frozen', 'expired', 'cancelled'])

export function SuspensionBanner() {
  const { data: subData } = useSubscription()
  const { data: manageUrl } = useManageUrl()

  const sub = subData?.subscription
  if (!sub) return null

  const shopifyStatus = sub.shopifyChargeStatus?.toLowerCase() ?? ''
  const isSuspended = SUSPENDED_STATUSES.has(shopifyStatus) && !sub.isGrandfathered
  if (!isSuspended) return null

  return (
    <div className="border-b border-amber-500/20 bg-amber-50 px-4 py-2.5 dark:bg-amber-950/30">
      <p className="text-center text-[13px] font-medium text-amber-800 dark:text-amber-200">
        This workspace has been suspended.{' '}
        {manageUrl ? (
          <a
            href={manageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-amber-900 dark:hover:text-amber-100"
          >
            Manage subscription in Shopify
          </a>
        ) : (
          'Contact support or resolve your billing to restore access.'
        )}
      </p>
    </div>
  )
}
