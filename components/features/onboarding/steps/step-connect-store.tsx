'use client'

import { useState } from 'react'
import { ShoppingBag, Store, Plus, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AddStoreModal } from '@/components/features/settings/stores/add-store-modal'
import { useConnectShopify } from '@/hooks/onboarding'
import { WizardShell } from '../wizard-shell'
import { ProgressFooter } from '../progress-footer'
import { StepHeading } from '../step-heading'
import { IconBadge } from '../icon-badge'

interface StepConnectStoreProps {
  onBack: () => void
  onNext: () => void
}

export function StepConnectStore({ onBack, onNext }: StepConnectStoreProps) {
  const [shop, setShop] = useState('')
  const [addStoreOpen, setAddStoreOpen] = useState(false)
  const connectShopify = useConnectShopify()

  function handleConnect() {
    const value = shop.trim()
    if (!value) return
    // Initiates Shopify OAuth and hands off to the returned authorize URL.
    // Requires an authenticated session — active once account creation is wired.
    connectShopify.mutate(value, {
      onSuccess: (res) => {
        if (res?.url) window.location.href = res.url
      },
    })
  }

  return (
    <WizardShell footer={<ProgressFooter stepIndex={3} onBack={onBack} onNext={onNext} />}>
      <div className="flex flex-col gap-6">
        <IconBadge icon={ShoppingBag} />

        <StepHeading
          title="Connect your Shopify store"
          description="Link your store to sync products, orders, and customers."
        />

        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              value={shop}
              onChange={(e) => setShop(e.target.value)}
              placeholder="yourstore.myshopify.com"
              autoComplete="off"
              spellCheck={false}
              className="h-11"
            />
            <Button
              size="lg"
              className="h-11 shrink-0"
              onClick={handleConnect}
              disabled={!shop.trim() || connectShopify.isPending}
            >
              {connectShopify.isPending ? 'Connecting…' : 'Connect Shopify'}
            </Button>
          </div>
          {connectShopify.isError && (
            <p className="text-xs text-destructive">Failed to connect Shopify. Try again.</p>
          )}
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-secondary text-primary">
            <Store className="size-5" />
          </div>
          <span className="text-sm font-medium text-foreground">5u3z59-ct</span>
          <span className="rounded-md bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
            Active
          </span>
          <span className="rounded-md bg-info-soft px-2 py-0.5 text-xs font-medium text-info">
            Payment
          </span>
          <button
            type="button"
            aria-label="Store options"
            className="ml-auto text-foreground-3 transition-colors hover:text-foreground"
          >
            <MoreVertical className="size-4" />
          </button>
        </div>

        <Button variant="outline" size="lg" className="self-start" onClick={() => setAddStoreOpen(true)}>
          <Plus className="size-4" />
          Add more stores
        </Button>

        <AddStoreModal open={addStoreOpen} onOpenChange={setAddStoreOpen} />
      </div>
    </WizardShell>
  )
}
