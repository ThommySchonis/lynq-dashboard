'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { BillingSummaryCard } from './billing-summary-card'
import { EmmaUsageCard } from './emma-usage-card'
import { UsagePlansTab } from './usage-plans-tab'
import { PaymentInfoTab } from './payment-info-tab'
import { PaymentHistoryTab } from './payment-history-tab'

type TabId = 'plans' | 'address' | 'history'

const TABS: { id: TabId; label: string }[] = [
  { id: 'plans',   label: 'Plans' },
  { id: 'address', label: 'Billing address' },
  { id: 'history', label: 'Invoice history' },
]

function isTabId(value: string | null): value is TabId {
  return value === 'plans' || value === 'address' || value === 'history'
}

export function BillingView() {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const paramTab    = searchParams.get('tab')
  const initialTab: TabId = isTabId(paramTab) ? paramTab : 'plans'

  const [activeTab, setActiveTab] = useState<TabId>(initialTab)

  useEffect(() => {
    if (isTabId(paramTab) && paramTab !== activeTab) setActiveTab(paramTab)
  }, [paramTab, activeTab])

  const switchTab = useCallback(
    (next: TabId) => {
      setActiveTab(next)
      const sp = new URLSearchParams(searchParams.toString())
      sp.set('tab', next)
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Your subscription is managed by Shopify.
        </p>
      </header>

      <BillingSummaryCard />

      <EmmaUsageCard />

      <div role="tablist" className="flex gap-1 border-b border-border">
        {TABS.map((tab) => {
          const active = tab.id === activeTab
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => switchTab(tab.id)}
              className={cn(
                'relative px-4 py-2.5 text-sm font-medium transition-colors',
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
              {active && <span className="absolute inset-x-0 -bottom-px h-[2px] bg-[#1C0F36]" />}
            </button>
          )
        })}
      </div>

      <div role="tabpanel">
        {activeTab === 'plans'   && <UsagePlansTab />}
        {activeTab === 'address' && <PaymentInfoTab />}
        {activeTab === 'history' && <PaymentHistoryTab />}
      </div>
    </div>
  )
}
