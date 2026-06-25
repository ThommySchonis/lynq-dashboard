'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Plus, Loader2, Store as StoreIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SettingsPageHeader } from '@/components/features/settings/settings-header'
import { SettingsEmptyState } from '@/components/features/settings/settings-empty-state'
import { StoresTable } from './stores-table'
import { AddStoreModal } from './add-store-modal'
import { useStores } from '@/hooks/stores'
import { useBillingStores } from '@/hooks/billing'
import { toast } from 'sonner'

const ERROR_MESSAGES: Record<string, string> = {
  missing_params: 'Authorization failed — missing parameters.',
  invalid_state: 'Authorization failed. Please try again.',
  invalid_hmac: 'Authorization failed. Please try again.',
  token_exchange_failed: 'Could not complete Shopify authorization. Please try again.',
  no_workspace: 'No workspace found. Please contact support.',
  save_failed: 'Failed to save connection. Please try again.',
}

export function StoresSettings() {
  const [addOpen, setAddOpen] = useState(false)
  const { data: stores, isLoading } = useStores()
  const { data: billingStores } = useBillingStores()
  const paymentsStoreDomain = billingStores?.find((s) => s.isBillingStore)?.shopifyDomain ?? null
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const shopify = searchParams.get('shopify')
    const error = searchParams.get('error')
    if (shopify === 'connected') {
      toast.success('Shopify store connected successfully')
    } else if (error) {
      toast.error(ERROR_MESSAGES[error] || 'Something went wrong. Please try again.')
    }
    if (shopify || error) {
      router.replace('/settings/workspace/stores')
    }
  }, [searchParams, router])

  const headerActions = useMemo(
    () => (
      <Button onClick={() => setAddOpen(true)}>
        <Plus size={16} strokeWidth={1.75} />
        Add store
      </Button>
    ),
    [],
  )

  const isTrulyEmpty = !isLoading && !stores?.length

  return (
    <div className="mx-auto flex min-h-full max-w-[920px] flex-col px-6 py-10">
      <SettingsPageHeader
        title="Stores"
        description="Manage your connected Shopify stores. Each store has its own orders, customers, and inbox."
        actions={headerActions}
      />

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center gap-2.5 text-sm text-muted-foreground">
          <Loader2 size={18} strokeWidth={1.75} className="animate-spin" />
          Loading stores…
        </div>
      ) : isTrulyEmpty ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="w-[440px] max-w-full rounded-2xl border bg-card px-10 py-9">
            <SettingsEmptyState
              Icon={StoreIcon}
              title="No stores connected yet"
              description="Connect your Shopify store to sync its orders, customers and inbox into Lynq."
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          <h2 className="text-xl font-bold text-foreground">Connected stores</h2>
          <StoresTable stores={stores ?? []} paymentsStoreDomain={paymentsStoreDomain} />
        </div>
      )}

      <AddStoreModal open={addOpen} onOpenChange={setAddOpen} />
    </div>
  )
}
