'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ADMIN_NAV, FEEDBACK_NAV, type NavItem } from '@/lib/admin-constants'
import { useClients, useInquiries, useFeedbackCount } from '@/hooks/admin'

function NavBadge({ variant, children }: { variant: 'default' | 'warning' | 'iris'; children: React.ReactNode }) {
  const base = 'text-[10px] font-bold rounded-full px-1.5 py-px leading-snug shrink-0'
  const variants: Record<string, string> = {
    default: 'bg-white/10 text-white/50',
    warning: 'bg-red-400 text-white',
    iris: 'bg-primary text-white',
  }
  return <span className={`${base} ${variants[variant]}`}>{children}</span>
}

function ClientCountBadge() {
  const { data } = useClients()
  const count = data?.length ?? 0
  if (count === 0) return null
  return <NavBadge variant="default">{count}</NavBadge>
}

function InquiryCountBadge() {
  const { data } = useInquiries()
  const count = data?.filter((i) => i.status === 'new').length ?? 0
  if (count === 0) return null
  return <NavBadge variant="warning">{count}</NavBadge>
}

function FeedbackCountBadge() {
  const { data } = useFeedbackCount()
  const count = data ?? 0
  if (count === 0) return null
  return <NavBadge variant="iris">{count}</NavBadge>
}

function BadgeSlot({ badgeKey }: { badgeKey?: NavItem['badge'] }) {
  if (badgeKey === 'clientCount') return <ClientCountBadge />
  if (badgeKey === 'newInquiries') return <InquiryCountBadge />
  return null
}

export function AdminSidebar() {
  const pathname = usePathname() ?? ''

  const feedbackActive = pathname.startsWith('/lynq-admin/feedback')
  const FeedbackIcon = FEEDBACK_NAV.icon

  return (
    <aside className="flex flex-col shrink-0 h-screen w-[220px] bg-[#0D0F14] antialiased">
      {/* Header */}
      <div className="px-4 pt-[18px] pb-[18px] border-b border-white/6">
        <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/25 mb-0.5">
          ADMIN
        </div>
        <div className="text-[13px] font-semibold text-white">Lynq &amp; Flow</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2">
        {ADMIN_NAV.map(({ group, items }) => (
          <div key={group}>
            <div className="text-[9px] uppercase tracking-[0.1em] text-white/20 px-2 pt-3 pb-1">
              {group}
            </div>
            {items.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center gap-2 py-[7px] px-2 rounded-md text-[12.5px] mb-px transition-all duration-100 no-underline border-l-[2.5px] ${
                    isActive
                      ? 'bg-violet-500/14 text-violet-300 font-medium border-l-violet-500 pl-[5.5px]'
                      : 'text-white/40 border-l-transparent hover:bg-white/6 hover:text-white/70'
                  }`}
                >
                  <Icon
                    size={15}
                    strokeWidth={1.75}
                    className={`shrink-0 ${isActive ? 'opacity-100 text-primary' : 'opacity-50'}`}
                  />
                  <span className="flex-1">{item.label}</span>
                  <BadgeSlot badgeKey={item.badge} />
                </Link>
              )
            })}
          </div>
        ))}

        {/* SUPPORT group — Feedback is always a route link */}
        <div>
          <div className="text-[9px] uppercase tracking-[0.1em] text-white/20 px-2 pt-3 pb-1">
            SUPPORT
          </div>
          <Link
            href={FEEDBACK_NAV.href}
            className={`flex items-center gap-2 py-[7px] px-2 rounded-md text-[12.5px] mb-px transition-all duration-100 no-underline border-l-[2.5px] ${
              feedbackActive
                ? 'bg-violet-500/14 text-violet-300 font-medium border-l-violet-500 pl-[5.5px]'
                : 'text-white/40 border-l-transparent hover:bg-white/6 hover:text-white/70'
            }`}
          >
            <FeedbackIcon
              size={15}
              strokeWidth={1.75}
              className={`shrink-0 ${feedbackActive ? 'opacity-100 text-primary' : 'opacity-50'}`}
            />
            <span className="flex-1">{FEEDBACK_NAV.label}</span>
            <FeedbackCountBadge />
          </Link>
        </div>
      </nav>

      {/* Footer */}
      <div className="px-2.5 py-3 border-t border-white/6">
        <Link
          href="/home"
          className="flex items-center gap-1.5 text-white/35 text-xs no-underline transition-colors duration-150 hover:text-white/60"
        >
          <ArrowLeft size={13} strokeWidth={1.75} />
          Back to Dashboard
        </Link>
      </div>
    </aside>
  )
}

export default AdminSidebar
