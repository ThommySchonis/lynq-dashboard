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
 * Store picker for the AI-agent settings pages (Figma node 1056-16 / 1068-16).
 * Always renders a dropdown with a trailing chevron so the row reads as
 * interactive and matches the Figma store row, even when a single store is
 * connected (the menu then lists just that store).
 */
export function AiStoreSelect({ stores, storeId, onChange }: AiStoreSelectProps) {
  return (
    <div className="flex w-full flex-col gap-2">
      <Label htmlFor="ai-store-select" className="text-sm font-semibold text-foreground">
        Store
      </Label>

      {/*
        modal={false} + alignItemWithTrigger={false} disable base-ui's scroll
        lock (the positioner locks scroll when either is active), which would
        otherwise reserve a scrollbar gutter on <html> and shift the centered
        content on open. The menu simply anchors below the trigger instead.
      */}
      <Select value={storeId} onValueChange={(v) => v && onChange(v)} modal={false}>
        <SelectTrigger
          id="ai-store-select"
          size="lg"
          className="w-full gap-2.5 rounded-[10px] border-settings-border bg-card py-[11px] pr-3.5 pl-3"
        >
          <StoreIconBox />
          <SelectValue placeholder="Select a store">
            {(value: string | null) => storeLabel(stores.find((s) => s.id === value))}
          </SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {stores.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {storeLabel(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
