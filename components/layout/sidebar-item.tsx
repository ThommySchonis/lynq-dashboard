'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface SidebarItemProps {
  href: string
  icon: LucideIcon
  label: string
  badge?: number
  collapsed?: boolean
}

export function SidebarItem({ href, icon: Icon, label, badge, collapsed }: SidebarItemProps) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className={cn(
        'flex h-10 items-center rounded-xl text-sm transition-colors duration-150',
        // Layout: centered icon (collapsed) vs icon + label (expanded).
        collapsed ? 'justify-center px-3' : 'gap-3 px-3',
        // Active = inverted (white tile, dark text). No hover override on active.
        isActive
          ? 'bg-white font-medium text-zinc-900'
          : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
      )}
    >
      <Icon
        className={cn(
          'size-5 shrink-0',
          isActive ? 'text-zinc-900' : 'text-zinc-400',
        )}
      />
      {!collapsed && (
        <>
          <span
            className={cn(
              'truncate',
              isActive ? 'text-zinc-900 font-medium' : 'text-zinc-300',
            )}
          >
            {label}
          </span>
          {badge !== undefined && badge > 0 && (
            <Badge
              variant="secondary"
              className={cn(
                'ml-auto text-xs px-1.5 py-0',
                isActive
                  ? 'bg-zinc-900/10 text-zinc-900'
                  : 'bg-zinc-700/40 text-zinc-300',
              )}
            >
              {badge}
            </Badge>
          )}
        </>
      )}
    </Link>
  )
}
