'use client'

import { Store } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface StoreOption {
  id: string
  name: string | null
  shopify_domain: string | null
}

interface StoreSelectorPillProps {
  stores: StoreOption[]
  value: string | null
  onChange: (storeId: string) => void
}

const CHIP =
  'flex items-center gap-2.5 rounded-[10px] border border-settings-border bg-card py-2 pl-2.5 pr-3'

function StoreIcon() {
  return (
    <span className="flex size-6 items-center justify-center rounded-[7px] bg-accent-soft">
      <Store size={15} strokeWidth={1.75} className="text-primary" />
    </span>
  )
}

export function StoreSelectorPill({ stores, value, onChange }: StoreSelectorPillProps) {
  const label = (id: string | null) => {
    const store = stores.find((s) => s.id === id)
    return store?.shopify_domain ?? store?.name ?? 'Select store'
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-foreground-3">Configuring emails for</span>

      {stores.length > 1 ? (
        <Select value={value ?? ''} onValueChange={(v) => v && onChange(v)}>
          <SelectTrigger className={CHIP}>
            <StoreIcon />
            <SelectValue>{(v: string | null) => label(v)}</SelectValue>
            <span className="size-[7px] rounded-full bg-success" />
          </SelectTrigger>
          <SelectContent>
            {stores.map((store) => (
              <SelectItem key={store.id} value={store.id}>
                {store.shopify_domain || store.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div className={CHIP}>
          <StoreIcon />
          <span className="text-sm font-semibold text-foreground">{label(value)}</span>
          <span className="size-[7px] rounded-full bg-success" />
        </div>
      )}
    </div>
  )
}
