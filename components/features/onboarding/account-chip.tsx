'use client'

import { ChevronDown } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'

interface AccountChipProps {
  storeName: string
  name: string
  email: string
}

/**
 * Account identity chip + dropdown shown in the header once an account exists (steps 5–7).
 * The leading white tile holds the compact Lynq brand mark (the Figma header's shortened logo);
 * the dropdown lists the account as store name / user name / email.
 * UI-first: a single account for now — render maps trivially to more once multi-account data exists.
 */
export function AccountChip({ storeName, name, email }: AccountChipProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex items-center gap-2.5 rounded-[10px] border border-transparent px-1 py-0.5 transition-colors hover:bg-accent-soft"
          />
        }
      >
        <div className="flex size-9 items-center justify-center rounded-[10px] border border-border bg-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="Lynq" className="h-[24px] w-[22px] object-contain" />
        </div>
        <div className="text-left leading-tight">
          <div className="text-sm font-medium text-foreground">{storeName}</div>
          <div className="text-xs text-foreground-3">
            {name} ({email})
          </div>
        </div>
        <ChevronDown className="size-4 text-foreground-3" />
      </PopoverTrigger>

      <PopoverContent align="start" sideOffset={8} className="w-72 p-1">
        <button
          type="button"
          className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-border bg-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="" className="h-[24px] w-[22px] object-contain" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-medium text-foreground">{storeName}</div>
            <div className="truncate text-xs text-foreground-2">{name}</div>
            <div className="truncate text-xs text-foreground-3">{email}</div>
          </div>
        </button>
      </PopoverContent>
    </Popover>
  )
}
