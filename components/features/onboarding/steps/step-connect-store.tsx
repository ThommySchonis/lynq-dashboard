'use client'

import { useState } from 'react'
import { ShoppingBag, Store, Plus, MoreVertical, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AddStoreModal } from '@/components/features/settings/stores/add-store-modal'
import { useConnectShopify } from '@/hooks/onboarding'
import { WizardShell } from '../wizard-shell'
import { ProgressFooter } from '../progress-footer'
import { StepHeading } from '../step-heading'

// UI-first: the connected store shown in the row (mock until real store state is wired).
const STORE_CODE = '5u3z59-ct'

interface StepConnectStoreProps {
  stepIndex: number
  onBack: () => void
  onNext: () => void
}

export function StepConnectStore({ stepIndex, onBack, onNext }: StepConnectStoreProps) {
  const [addStoreOpen, setAddStoreOpen] = useState(false)
  const connectShopify = useConnectShopify()

  // Re-sync / reconnect the store in the row via Shopify OAuth.
  function handleSync() {
    connectShopify.mutate(STORE_CODE, {
      onSuccess: (res) => {
        if (res?.url) window.location.href = res.url
      },
    })
  }

  return (
    <WizardShell footer={<ProgressFooter stepIndex={stepIndex} onBack={onBack} onNext={onNext} />}>
      <div className="flex flex-col gap-6">
        {/* Heading: centered Shopify badge + title, with a refresh action on the right */}
        <div className="flex flex-col items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-card">
            <ShoppingBag className="size-4 text-primary" />
          </div>
          <div className="flex w-full items-center justify-between gap-2">
            <span aria-hidden className="size-11 shrink-0" />
            <StepHeading
              center
              className="flex-1"
              title="Connect your Shopify store"
              description="Link your store to sync products, orders, and customers"
            />
            <button
              type="button"
              aria-label="Reconnect store"
              onClick={handleSync}
              disabled={connectShopify.isPending}
              className="flex size-11 shrink-0 items-center justify-center text-foreground-3 transition-colors hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={cn('size-4', connectShopify.isPending && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Connected stores + add another */}
        <div className="flex flex-col items-center gap-2.5">
          <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Store className="size-4 text-foreground-3" />
              <span className="text-sm text-foreground">5u3z59-ct</span>
              <Badge variant="success" className="rounded-md">Active</Badge>
              <Badge variant="info" className="rounded-md">Payment</Badge>
            </div>
            <button
              type="button"
              aria-label="Store options"
              className="text-foreground-3 transition-colors hover:text-foreground"
            >
              <MoreVertical className="size-4" />
            </button>
          </div>

          <Button variant="outline" size="lg" onClick={() => setAddStoreOpen(true)}>
            <Plus className="size-4" />
            Add more stores
          </Button>
        </div>

        <AddStoreModal open={addStoreOpen} onOpenChange={setAddStoreOpen} />
      </div>
    </WizardShell>
  )
}
