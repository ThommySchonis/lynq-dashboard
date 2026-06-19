'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { PenSquare, Shield, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { useInboxCounts } from '@/hooks/inbox'
import { useSearchStore } from '@/stores/search'
import { Separator } from '@/components/ui/separator'
import { SidebarItem } from './sidebar-item'
import { SidebarGroup } from './sidebar-group'
import { SidebarInboxItem } from './sidebar-inbox-item'
import { SidebarUser } from './sidebar-user'
import { StoreSwitcher } from './store-switcher'
import { PlanBadge } from './plan-badge'
import { SearchButton } from '@/components/features/search/search-button'
import { SearchDialog } from '@/components/features/search/search-dialog'
import { NotificationBell } from '@/components/features/notifications/notification-bell'
import {
  SIDEBAR_PRIMARY_NAV,
  SIDEBAR_GROUPS,
  SIDEBAR_GROUPS_CAPTION,
  SIDEBAR_FOOTER_NAV,
} from '@/lib/sidebar-constants'

// Light theme redesign (Figma 776-17279). Hover-expand mechanic retained:
// w-16 default → w-56 on hover via local React state, keeping the `collapsed`
// prop contract that SidebarItem / SidebarUser / StoreSwitcher rely on.
export function Sidebar() {
  const role = useAuthStore((s) => s.role)
  const openSearch = useSearchStore((s) => s.open)
  const [hovered, setHovered] = useState(false)
  const collapsed = !hovered

  const { data: inboxCounts } = useInboxCounts()
  const inboxBadge = inboxCounts?.open ?? 0

  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden',
        'border-r border-border bg-card',
        'transition-[width] duration-200 ease-out',
        collapsed ? 'w-16' : 'w-56',
      )}
    >
      {/* Logo / brand + header actions */}
      <div
        className={cn(
          'flex shrink-0',
          collapsed ? 'flex-col items-center gap-1 py-2' : 'h-14 flex-row items-center gap-2 px-3',
        )}
      >
        <Link
          href="/home"
          className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-2')}
        >
          <Image
            src="/brand/lynq-flow-icon.png"
            alt="Lynq & Flow"
            width={40}
            height={40}
            className="shrink-0"
            priority
          />
          {!collapsed && (
            <span className="truncate text-sm font-semibold text-foreground">
              Lynq &amp; Flow
            </span>
          )}
        </Link>
        {!collapsed && (
          <Link
            href="/inbox/create"
            aria-label="New message"
            title="New message"
            className="ml-auto flex size-7 items-center justify-center rounded-md text-foreground-3 transition-colors hover:bg-muted hover:text-foreground"
          >
            <PenSquare size={16} />
          </Link>
        )}
        <SearchButton collapsed={collapsed} />
      </div>

      {/* Store switcher */}
      <div className="px-3 py-1">
        <StoreSwitcher collapsed={collapsed} />
      </div>

      {/* Main nav — primary items + collapsible groups */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {SIDEBAR_PRIMARY_NAV.map((item) =>
          item.variant === 'submenu' ? (
            <SidebarInboxItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              collapsed={collapsed}
              badge={inboxBadge}
            />
          ) : (
            <SidebarItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              collapsed={collapsed}
            />
          ),
        )}

        <Separator className="my-1.5 bg-border" />
        {!collapsed && (
          <p className="px-3 pb-1 pt-1 text-xs font-medium text-foreground-4">
            {SIDEBAR_GROUPS_CAPTION}
          </p>
        )}
        {SIDEBAR_GROUPS.map((group) => (
          <SidebarGroup key={group.label} label={group.label} items={group.items} collapsed={collapsed} />
        ))}
      </nav>

      {/* Footer: plan badge → secondary nav → user */}
      <div className="space-y-0.5 px-3 py-2">
        <PlanBadge collapsed={collapsed} />
        <Separator className="my-2 bg-border" />
        <NotificationBell collapsed={collapsed} variant="row" />
        {SIDEBAR_FOOTER_NAV.map((item) => (
          <SidebarItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            collapsed={collapsed}
          />
        ))}
        <SidebarItem icon={HelpCircle} label="Help" onClick={openSearch} collapsed={collapsed} />
        {(role === 'owner' || role === 'admin') && (
          <SidebarItem href="/admin" icon={Shield} label="Admin" collapsed={collapsed} />
        )}
        <Separator className="my-2 bg-border" />
        <SidebarUser collapsed={collapsed} />
      </div>

      <SearchDialog />
    </aside>
  )
}
