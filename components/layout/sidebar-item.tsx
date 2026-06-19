'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

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
        'group relative flex h-10 items-center rounded-[9px] text-sm transition-colors duration-150',
        collapsed ? 'justify-center px-3' : 'gap-3 px-3',
        // Active = soft purple tile, 2px left accent border + subtle glow (Figma 776-17279).
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
          {badge !== undefined && badge > 0 && (
            <span className="ml-auto rounded-full bg-border px-2 py-0.5 text-xs font-medium text-foreground-3">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </>
      )}
    </Link>
  )
}
