'use client'

import { useState } from 'react'
import { ShoppingBag, Store, Plus, MoreVertical, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AddStoreModal } from '@/components/features/settings/stores/add-store-modal'
import { useConnectShopify } from '@/hooks/onboarding'
import { useStoreStore } from '@/stores/store'
import { WizardShell } from '../wizard-shell'
import { ProgressFooter } from '../progress-footer'
import { StepHeading } from '../step-heading'

interface StepConnectStoreProps {
  stepIndex: number
  onBack: () => void
  onNext: () => void
}

export function StepConnectStore({ stepIndex, onBack, onNext }: StepConnectStoreProps) {
  const [addStoreOpen, setAddStoreOpen] = useState(false)
  const connectShopify = useConnectShopify()
  // Connected stores — empty until one is added via the backend ("Add more stores").
  const stores = useStoreStore((s) => s.stores)

  // Reconnect / re-sync a store row via Shopify OAuth.
  function handleSync(domain: string | null) {
    if (!domain) return
    connectShopify.mutate(domain, {
      onSuccess: (res) => {
        if (res?.url) window.location.href = res.url
      },
    })
  }

  return (
    <WizardShell footer={<ProgressFooter stepIndex={stepIndex} onBack={onBack} onNext={onNext} />}>
      <div className="flex flex-col gap-6">
        {/* Heading: centered Shopify badge + title */}
        <div className="flex flex-col items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-card">
            <ShoppingBag className="size-4 text-primary" />
          </div>
          <StepHeading
            center
            title="Connect your Shopify store"
            description="Link your store to sync products, orders, and customers"
          />
        </div>

        {/* Connected stores (empty until added) + add another */}
        <div className="flex flex-col items-center gap-2.5">
          {stores.map((store) => (
            <div
              key={store.id}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <div className="flex items-center gap-2.5">
                <Store className="size-4 text-foreground-3" />
                <span className="text-sm text-foreground">{store.name}</span>
                <Badge variant="success" className="rounded-md">Active</Badge>
                <Badge variant="info" className="rounded-md">Payment</Badge>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Reconnect store"
                  onClick={() => handleSync(store.shopify_domain)}
                  disabled={connectShopify.isPending}
                  className="flex size-8 items-center justify-center text-foreground-3 transition-colors hover:text-foreground disabled:opacity-50"
                >
                  <RefreshCw className={cn('size-4', connectShopify.isPending && 'animate-spin')} />
                </button>
                <button
                  type="button"
                  aria-label="Store options"
                  className="flex size-8 items-center justify-center text-foreground-3 transition-colors hover:text-foreground"
                >
                  <MoreVertical className="size-4" />
                </button>
              </div>
            </div>
          ))}

          <Button variant="outline" size="lg" onClick={() => setAddStoreOpen(true)}>
            <Plus className="size-4" />
            {stores.length === 0 ? 'Add store' : 'Add more stores'}
          </Button>
        </div>

        <AddStoreModal open={addStoreOpen} onOpenChange={setAddStoreOpen} />
      </div>
    </WizardShell>
  )
}
