'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Plus, Store } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStoreStore } from '@/stores/store'
import { useAuthStore } from '@/stores/auth'
import type { StorePublic } from '@/types/stores'

interface StoreSwitcherProps {
  collapsed: boolean
}

/**
 * Store switcher as an inline collapsible menu (Figma 189-13486): a header row
 * with a chevron that expands a list of stores (active = purple dot + "Current"
 * badge) plus an "Add Store" action. Collapsed rail shows just the icon.
 */
export function StoreSwitcher({ collapsed }: StoreSwitcherProps) {
  const [open, setOpen] = useState(false)
  const stores = useStoreStore((s) => s.stores)
  const activeStore = useStoreStore((s) => s.activeStore)
  const setActiveStore = useStoreStore((s) => s.setActiveStore)
  const isLoading = useStoreStore((s) => s.isLoading)
  const workspaceId = useAuthStore((s) => s.workspaceId)

  if (isLoading) return null

  // No stores yet → single "Add store" entry.
  if (stores.length === 0) {
    return (
      <Link
        href="/settings/workspace/stores"
        className={cn(
          'flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left transition-colors hover:bg-muted',
          collapsed ? 'justify-center' : '',
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-primary">
          <Plus className="size-4" />
        </span>
        {!collapsed && <p className="truncate text-sm font-medium text-foreground-3">Add store</p>}
      </Link>
    )
  }

  if (collapsed) {
    return (
      <div className="flex justify-center px-2.5 py-2">
        <span className="flex size-8 items-center justify-center rounded-lg text-foreground-3">
          <Store className="size-5" />
        </span>
      </div>
    )
  }

  function handleSelect(store: StorePublic) {
    setActiveStore(store, workspaceId)
    setOpen(false)
  }

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-2 rounded-[9px] px-2.5 py-2 text-left transition-colors hover:bg-muted',
          open && 'shadow-[0_4px_20px_rgba(161,117,252,0.2)]',
        )}
      >
        <Store className="size-5 shrink-0 text-foreground-3" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {activeStore?.name ?? 'Store'}
        </span>
        <ChevronDown
          className={cn(
            'size-[18px] shrink-0 text-foreground-4 transition-transform duration-150',
            open ? '' : '-rotate-90',
          )}
        />
      </button>

      {open && (
        <div className="relative flex flex-col gap-0.5 py-1 pl-3.5 before:absolute before:bottom-1 before:left-2 before:top-1 before:w-px before:bg-border">
          {stores.map((store) => {
            const isActive = store.id === activeStore?.id
            return (
              <button
                key={store.id}
                type="button"
                onClick={() => handleSelect(store)}
                className="flex items-center gap-2 rounded-lg px-2.5 py-[7px] text-left transition-colors hover:bg-muted"
              >
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    isActive ? 'bg-primary' : 'bg-foreground-4',
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground-3">{store.name}</span>
                {isActive && (
                  <span className="shrink-0 rounded-md bg-input px-2 py-0.5 text-xs font-medium text-foreground-3">
                    Current
                  </span>
                )}
              </button>
            )
          })}

          <Link
            href="/settings/workspace/stores"
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-muted"
          >
            <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-accent-soft">
              <Plus className="size-3" />
            </span>
            Add Store
          </Link>
        </div>
      )}
    </div>
  )
}
