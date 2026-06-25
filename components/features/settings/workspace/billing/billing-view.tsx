'use client'

import { SettingsPageHeader } from '@/components/features/settings/settings-header'
import { CurrentPlanCard } from './current-plan-card'
import { ChangePlanSection } from './change-plan-section'
import { PaymentMethodCard } from './payment-method-card'
import { BillingHistoryTable } from './billing-history-table'

export function BillingView() {
  return (
    <div className="mx-auto flex min-h-full max-w-[914px] flex-col gap-[30px] px-6 py-10">
      <SettingsPageHeader
        title="Billing"
        description="Manage your subscription, payment method, and invoices."
      />

      <CurrentPlanCard />
      <ChangePlanSection />
      <PaymentMethodCard />
      <BillingHistoryTable />
    </div>
  )
}
