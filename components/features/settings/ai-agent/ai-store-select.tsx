'use client'

import { Store as StoreIcon } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import type { StorePublic } from '@/types/stores'

interface AiStoreSelectProps {
  stores: StorePublic[]
  storeId: string
  onChange: (id: string) => void
}

/** Shopify glyph in a rounded, brand-tinted square (Figma node 1056-17). */
function StoreIconBox() {
  return (
    <span className="flex size-[22px] shrink-0 items-center justify-center rounded-md bg-primary/8">
      <StoreIcon size={13} strokeWidth={1.75} className="text-primary" />
    </span>
  )
}

function storeLabel(store: StorePublic | undefined): string {
  return store?.shopify_domain ?? store?.name ?? ''
}

/**
 * Store picker for the AI-agent onboarding page (Figma node 1056-16). A single
 * store renders as a static row; multiple stores render a dropdown with a
 * trailing chevron so it can be switched.
 */
export function AiStoreSelect({ stores, storeId, onChange }: AiStoreSelectProps) {
  const selected = stores.find((s) => s.id === storeId) ?? stores[0]

  return (
    <div className="flex w-full flex-col gap-1.5">
      <Label htmlFor="ai-store-select" className="text-sm font-semibold text-foreground">
        Store
      </Label>

      {stores.length <= 1 ? (
        <div className="flex items-center gap-2.5 rounded-[10px] border border-settings-border bg-card py-2.5 pr-3.5 pl-3 text-sm text-foreground">
          <StoreIconBox />
          <span className="flex-1 truncate">{storeLabel(selected)}</span>
        </div>
      ) : (
        <Select value={storeId} onValueChange={(v) => v && onChange(v)}>
          <SelectTrigger
            id="ai-store-select"
            className="h-auto w-full gap-2.5 rounded-[10px] border-settings-border bg-card py-2.5 pr-3.5 pl-3"
          >
            <StoreIconBox />
            <SelectValue placeholder="Select a store">
              {(value: string | null) => storeLabel(stores.find((s) => s.id === value))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {stores.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {storeLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
