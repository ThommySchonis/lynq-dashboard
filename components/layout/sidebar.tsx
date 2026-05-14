'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Home, Inbox, BarChart3, Zap, Clock, Package, GraduationCap,
  Rss, Settings, Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { Separator } from '@/components/ui/separator'
import { SidebarItem } from './sidebar-item'
import { SidebarUser } from './sidebar-user'

const NAV_ITEMS = [
  { href: '/home',          icon: Home,           label: 'Home'          },
  { href: '/inbox',         icon: Inbox,          label: 'Inbox'         },
  { href: '/analytics',     icon: BarChart3,      label: 'Analytics'     },
  { href: '/performance',   icon: Zap,            label: 'Performance'   },
  { href: '/time-tracking', icon: Clock,          label: 'Time Tracking' },
  { href: '/supply-chain',  icon: Package,        label: 'Supply Chain'  },
  { href: '/academy',       icon: GraduationCap,  label: 'Academy'       },
  { href: '/value-feed',    icon: Rss,            label: 'Value Feed'    },
] as const

const BOTTOM_ITEMS = [
  { href: '/settings', icon: Settings, label: 'Settings' },
  { href: '/admin',    icon: Shield,   label: 'Admin'    },
] as const

// Iteration 1: structural redesign only.
//   - Floating dark surface with rounded-2xl + m-3
//   - w-16 default → w-56 on hover, hover-driven via local React state
//     (Tailwind `group-hover` was an option; onMouseEnter/Leave keeps the
//     existing `collapsed` prop contract for SidebarItem / SidebarUser
//     without touching those files)
//   - Manual toggle button removed — hover is the only expand trigger
//
// Iteration 2 (post-feedback): per-item hover polish, active-state white
// circle, footer redesign with user avatar + toggle controls.
export function Sidebar() {
  const role = useAuthStore((s) => s.role)
  const [hovered, setHovered] = useState(false)
  const collapsed = !hovered

  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'fixed left-3 top-3 bottom-3 z-40 flex flex-col overflow-hidden',
        'rounded-2xl border border-zinc-800/60 bg-zinc-900 shadow-xl shadow-black/5',
        'transition-[width] duration-200 ease-out',
        collapsed ? 'w-16' : 'w-56',
      )}
    >
      {/* Logo / brand */}
      <Link
        href="/home"
        className={cn(
          'flex h-14 items-center shrink-0',
          collapsed ? 'justify-center px-2' : 'gap-2.5 px-3',
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary">
          <Image src="/logo.png" alt="Lynq" width={20} height={20} />
        </span>
        {!collapsed && (
          <span className="truncate text-sm font-semibold text-white">
            Lynq &amp; Flow
          </span>
        )}
      </Link>

      {/* Main nav — keeps existing SidebarItem styling for iteration 1. */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV_ITEMS.map((item) => (
          <SidebarItem key={item.href} {...item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Bottom items + user — iter 2 will polish this section. */}
      <div className="space-y-0.5 p-2">
        <Separator className="mb-2 bg-zinc-800/60" />
        {BOTTOM_ITEMS.map((item) => {
          if (item.href === '/admin' && role !== 'owner' && role !== 'admin') return null
          return <SidebarItem key={item.href} {...item} collapsed={collapsed} />
        })}
        <Separator className="my-2 bg-zinc-800/60" />
        <SidebarUser collapsed={collapsed} />
      </div>
    </aside>
  )
}
