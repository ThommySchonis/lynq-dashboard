'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, ChevronDown, Plus, Store } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStoreStore } from '@/stores/store'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import type { StorePublic } from '@/types/stores'

interface StoreSwitcherProps {
  collapsed: boolean
}

export function StoreSwitcher({ collapsed }: StoreSwitcherProps) {
  const [open, setOpen] = useState(false)
  const stores = useStoreStore((s) => s.stores)
  const activeStore = useStoreStore((s) => s.activeStore)
  const setActiveStore = useStoreStore((s) => s.setActiveStore)
  const isLoading = useStoreStore((s) => s.isLoading)

  if (isLoading) return null

  if (stores.length === 0) {
    return (
      <Link
        href="/settings/workspace/stores"
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left',
          'transition-colors hover:bg-white/5',
          collapsed ? 'justify-center' : '',
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Plus className="size-4" />
        </span>
        {!collapsed && (
          <p className="truncate text-sm font-medium text-zinc-400">
            Add store
          </p>
        )}
      </Link>
    )
  }

  function handleSelect(store: StorePublic) {
    setActiveStore(store)
    setOpen(false)
  }

  const hasMultiple = stores.length > 1

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left',
              'transition-colors hover:bg-white/5',
              collapsed ? 'justify-center' : '',
              !hasMultiple && 'cursor-default hover:bg-transparent'
            )}
            onClick={hasMultiple ? undefined : (e) => e.preventDefault()}
            disabled={!hasMultiple}
          />
        }
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Store className="size-4" />
        </span>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {activeStore?.name ?? 'No store'}
              </p>
              <p className="truncate text-xs text-zinc-400">
                {activeStore?.shopify_domain ?? ''}
              </p>
            </div>
            {hasMultiple && (
              <ChevronDown className="size-3.5 shrink-0 text-zinc-500" />
            )}
          </>
        )}
      </PopoverTrigger>

      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-64 p-1"
      >
        <div className="flex flex-col">
          {stores.map((store) => {
            const isActive = store.id === activeStore?.id
            const isConnected = !!store.shopify_connected_at
            return (
              <button
                key={store.id}
                onClick={() => handleSelect(store)}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm',
                  'transition-colors hover:bg-accent',
                  isActive && 'bg-accent'
                )}
              >
                <span
                  className={cn(
                    'size-2 shrink-0 rounded-full',
                    isConnected ? 'bg-green-500' : 'bg-red-500'
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {store.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {store.shopify_domain}
                  </p>
                </div>
                {isActive && <Check className="size-3.5 shrink-0 text-primary" />}
              </button>
            )
          })}

          <Link
            href="/settings/workspace/stores"
            className="mt-1 flex items-center gap-2 rounded-md border-t border-border px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Plus className="size-3.5" />
            Add store
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
