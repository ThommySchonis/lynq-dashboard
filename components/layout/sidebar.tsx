'use client'

import Image from 'next/image'
import {
  Home, Inbox, BarChart3, Zap, Package, GraduationCap,
  Rss, Settings, PanelLeftClose, PanelLeft, Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarItem } from './sidebar-item'
import { SidebarUser } from './sidebar-user'

const NAV_ITEMS = [
  { href: '/home', icon: Home, label: 'Home' },
  { href: '/inbox', icon: Inbox, label: 'Inbox' },
  { href: '/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/performance', icon: Zap, label: 'Performance' },
  { href: '/supply-chain', icon: Package, label: 'Supply Chain' },
  { href: '/academy', icon: GraduationCap, label: 'Academy' },
  { href: '/value-feed', icon: Rss, label: 'Value Feed' },
] as const

const BOTTOM_ITEMS = [
  { href: '/settings', icon: Settings, label: 'Settings' },
  { href: '/admin', icon: Shield, label: 'Admin' },
] as const

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const role = useAuthStore((s) => s.role)

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] transition-[width] duration-200',
        collapsed ? 'w-[60px]' : 'w-[208px]',
      )}
    >
      <div
        className={cn(
          'flex h-14 items-center border-b border-[var(--sidebar-border)]',
          collapsed ? 'justify-center px-2' : 'gap-2.5 px-4',
        )}
      >
        <Image src="/logo.png" alt="Lynq" width={28} height={28} className="shrink-0" />
        {!collapsed && (
          <span className="text-sm font-semibold text-[var(--sidebar-label-active)]">
            Lynq & Flow
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={cn('ml-auto h-7 w-7 shrink-0', collapsed && 'ml-0')}
        >
          {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </Button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {NAV_ITEMS.map((item) => (
          <SidebarItem key={item.href} {...item} collapsed={collapsed} />
        ))}
      </nav>

      <div className="space-y-0.5 px-2 pb-2">
        <Separator className="mb-2" />
        {BOTTOM_ITEMS.map((item) => {
          if (item.href === '/admin' && role !== 'owner' && role !== 'admin') return null
          return <SidebarItem key={item.href} {...item} collapsed={collapsed} />
        })}
        <Separator className="my-2" />
        <SidebarUser collapsed={collapsed} />
      </div>
    </aside>
  )
}
