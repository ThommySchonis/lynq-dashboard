'use client'

import { CreditCard } from 'lucide-react'
import { useManageUrl } from '@/hooks/billing/use-billing-data'
import { useAuthStore } from '@/stores/auth'

/**
 * Payment method + billing email. Card details live in Shopify (managed
 * pricing) and aren't exposed to the app, so the method row is a managed
 * placeholder; both actions deep-link to the Shopify billing page.
 */
export function PaymentMethodCard() {
  const { data: manageUrl } = useManageUrl()
  const email = useAuthStore((s) => s.user?.email)

  const openManage = () => {
    if (manageUrl) window.open(manageUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      <h2 className="text-lg font-bold text-foreground">Payment method</h2>

      <div className="rounded-2xl border border-settings-border bg-card">
        <div className="flex items-center justify-between gap-4 px-[22px] py-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-8 w-12 items-center justify-center rounded-[7px] border border-settings-border bg-card">
              <CreditCard size={18} strokeWidth={1.75} className="text-foreground-3" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-foreground">Payment method</span>
              <span className="text-xs font-medium text-foreground-3">Managed through Shopify</span>
            </div>
          </div>
          <button
            type="button"
            onClick={openManage}
            disabled={!manageUrl}
            className="rounded-[9px] border border-settings-border bg-card px-4 py-[9px] text-sm font-semibold text-foreground-2 transition-colors hover:bg-foreground/[0.03] disabled:opacity-50"
          >
            Update
          </button>
        </div>

        <div className="h-px w-full bg-settings-divider" />

        <div className="flex items-center justify-between gap-4 px-[22px] py-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-foreground-4">Billing email</span>
            <span className="text-sm font-semibold text-foreground">{email ?? '—'}</span>
          </div>
          <button
            type="button"
            onClick={openManage}
            disabled={!manageUrl}
            className="text-xs font-semibold text-primary transition-colors hover:text-primary-hover disabled:opacity-50"
          >
            Edit
          </button>
        </div>
      </div>
    </>
  )
}
