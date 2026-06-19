'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SidebarItem } from './sidebar-item'
import type { SidebarNavItem } from '@/lib/sidebar-constants'

interface SidebarGroupProps {
  label: string
  items: SidebarNavItem[]
  collapsed?: boolean
}

/**
 * Collapsible nav group with a chevron header (Figma 189-13486). Defaults open.
 * In the hover-collapsed rail the header is hidden and the item icons render
 * directly, keeping the icon-only rail intact.
 */
export function SidebarGroup({ label, items, collapsed }: SidebarGroupProps) {
  const [open, setOpen] = useState(true)

  if (collapsed) {
    return (
      <div className="space-y-0.5">
        {items.map((item) => (
          <SidebarItem key={item.href} href={item.href} icon={item.icon} label={item.label} collapsed />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-9 w-full items-center justify-between rounded-[9px] px-3 text-sm text-foreground-3 transition-colors hover:bg-muted hover:text-foreground"
      >
        <span className="truncate">{label}</span>
        <ChevronDown
          className={cn('size-4 shrink-0 text-foreground-4 transition-transform duration-150', open ? '' : '-rotate-90')}
        />
      </button>
      {open &&
        items.map((item) => (
          <SidebarItem key={item.href} href={item.href} icon={item.icon} label={item.label} />
        ))}
    </div>
  )
}
