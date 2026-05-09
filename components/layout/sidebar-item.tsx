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
        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-[rgba(139,92,246,0.14)] text-[#C4B5FD]'
          : 'text-white/60 hover:bg-white/[0.04]',
        collapsed && 'justify-center px-2',
      )}
    >
      <Icon
        size={18}
        className={cn(
          isActive
            ? 'text-[#C4B5FD]'
            : 'text-white/40',
        )}
      />
      {!collapsed && (
        <>
          <span className="truncate">{label}</span>
          {badge !== undefined && badge > 0 && (
            <Badge
              variant="secondary"
              className="ml-auto bg-primary/10 text-primary text-xs px-1.5 py-0"
            >
              {badge}
            </Badge>
          )}
        </>
      )}
    </Link>
  )
}
