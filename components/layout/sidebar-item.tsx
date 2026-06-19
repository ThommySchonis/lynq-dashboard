'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarItemProps {
  icon: LucideIcon
  label: string
  collapsed?: boolean
  /** Link target. Omit and pass `onClick` to render an action button instead. */
  href?: string
  onClick?: () => void
}

export function SidebarItem({ href, icon: Icon, label, collapsed, onClick }: SidebarItemProps) {
  const pathname = usePathname()
  const isActive = href ? pathname === href || pathname.startsWith(href + '/') : false

  const className = cn(
    'group relative flex h-10 w-full items-center rounded-[9px] text-sm transition-colors duration-150',
    collapsed ? 'justify-center px-3' : 'gap-3 px-3',
    // Active = soft purple tile, 2px left accent border + subtle glow (Figma 776-17279).
    isActive
      ? 'bg-accent-soft font-medium text-foreground shadow-[0_4px_20px_rgba(161,117,252,0.2)] before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary'
      : 'text-foreground-2 hover:bg-muted hover:text-foreground',
  )

  const content = (
    <>
      <Icon
        className={cn(
          'size-5 shrink-0',
          isActive ? 'text-primary' : 'text-foreground-3 group-hover:text-foreground',
        )}
      />
      {!collapsed && <span className="truncate">{label}</span>}
    </>
  )

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={className}>
      {content}
    </button>
  )
}
