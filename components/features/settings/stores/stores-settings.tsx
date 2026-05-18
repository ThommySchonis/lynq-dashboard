'use client'

import { useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SettingsSection } from '@/components/features/settings/settings-section'
import { StoreCard } from './store-card'
import { AddStoreModal } from './add-store-modal'
import { useStores } from '@/hooks/stores'

export function StoresSettings() {
  const [addOpen, setAddOpen] = useState(false)
  const { data: stores, isLoading } = useStores()

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
