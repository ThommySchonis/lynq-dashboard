'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SettingsSection } from '@/components/features/settings/settings-section'
import { StoreCard } from './store-card'
import { AddStoreModal } from './add-store-modal'
import { useStores } from '@/hooks/stores'
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

  return (
    <div className="max-w-3xl mx-auto px-10 py-12 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Stores</h1>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            Manage your connected Shopify stores. Each store has its own orders, customers, and inbox.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="size-3.5" />
          Add store
        </Button>
      </div>

      {/* Store list */}
      <SettingsSection title="Connected stores">
        {isLoading ? (
          <div className="flex items-center gap-2.5 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Loading stores…
          </div>
        ) : !stores?.length ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No stores connected yet. Click &ldquo;Add store&rdquo; to get started.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {stores.map((store) => (
              <StoreCard key={store.id} store={store} />
            ))}
          </div>
        )}
      </SettingsSection>

      <AddStoreModal open={addOpen} onOpenChange={setAddOpen} />
    </div>
  )
}
