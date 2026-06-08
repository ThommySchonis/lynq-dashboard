'use client'
import { useState } from 'react'
import { useBillingStores } from '@/hooks/billing/use-billing-data'
import { useSetBillingStore } from '@/hooks/billing/use-billing-mutations'

interface Props { open: boolean; onClose: () => void }

export function BillingStorePickerModal({ open, onClose }: Props) {
  const storesQ = useBillingStores()
  const setM = useSetBillingStore()
  const [selected, setSelected] = useState<string | null>(null)

  if (!open) return null
  const stores = storesQ.data ?? []

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-medium">Choose billing store</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Changing the billing store will cancel the current Shopify subscription
          and send you to the new store to re-subscribe.
        </p>

        <ul className="mt-4 space-y-2">
          {stores.map((store) => (
            <li key={store.id}>
              <label className="flex items-center gap-3 rounded-md border border-border p-3 hover:bg-muted cursor-pointer">
                <input
                  type="radio"
                  name="billing-store"
                  value={store.id}
                  checked={selected === store.id}
                  onChange={() => setSelected(store.id)}
                  disabled={store.isBillingStore}
                />
                <span className="flex-1 text-sm">{store.shopifyDomain}</span>
                {store.isBillingStore && (
                  <span className="text-xs text-muted-foreground">Current</span>
                )}
              </label>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selected || setM.isPending}
            onClick={() => {
              if (!selected) return
              void setM.mutateAsync(selected).then((result) => {
                window.open(result.managedPricingUrl, '_blank', 'noopener,noreferrer')
                onClose()
              })
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {setM.isPending ? 'Saving…' : 'Change and continue in Shopify'}
          </button>
        </div>
      </div>
    </div>
  )
}
