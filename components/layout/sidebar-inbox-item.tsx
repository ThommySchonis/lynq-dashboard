'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CountBadge } from '@/components/shared/count-badge'
import { SidebarInboxFolders } from './sidebar-inbox-folders'

interface SidebarInboxItemProps {
  href: string
  icon: LucideIcon
  label: string
  badge?: number
  collapsed?: boolean
}

/**
 * Inbox nav item with a collapsible folder submenu (Figma 776-17288 / 168-7788).
 * The chevron toggles the submenu; it defaults open while the inbox route is
 * active. Clicking the row still navigates to /inbox.
 */
export function SidebarInboxItem({ href, icon: Icon, label, badge, collapsed }: SidebarInboxItemProps) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + '/')

  // Default expanded when the inbox route is active; chevron overrides manually.
  const [override, setOverride] = useState<boolean | null>(null)
  const expanded = override ?? isActive

  function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setOverride(!expanded)
  }

  return (
    <div>
      <Link
        href={href}
        className={cn(
          'group relative flex h-10 items-center rounded-[9px] text-sm transition-colors duration-150',
          collapsed ? 'justify-center px-3' : 'gap-2 px-3',
          isActive
            ? 'bg-accent-soft font-medium text-foreground shadow-[0_4px_20px_rgba(161,117,252,0.2)] before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary'
            : 'text-foreground-2 hover:bg-muted hover:text-foreground',
        )}
      >
        <Icon
          className={cn(
            'size-5 shrink-0',
            isActive ? 'text-primary' : 'text-foreground-3 group-hover:text-foreground',
          )}
        />
        {!collapsed && (
          <>
            <span className="truncate">{label}</span>
            <button
              type="button"
              onClick={toggle}
              aria-label={expanded ? 'Collapse inbox folders' : 'Expand inbox folders'}
              aria-expanded={expanded}
              className="-m-1 flex shrink-0 items-center justify-center rounded p-1 text-foreground-3 hover:text-foreground"
            >
              <ChevronDown
                className={cn('size-[18px] transition-transform duration-150', expanded ? '' : '-rotate-90')}
              />
            </button>
            <CountBadge count={badge ?? 0} />
          </>
        )}
      </Link>
      {!collapsed && expanded && <SidebarInboxFolders />}
    </div>
  )
}
