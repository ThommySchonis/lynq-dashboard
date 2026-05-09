'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, Users, UserPlus, Radio, Bell, MessageSquare,
  UserCheck, Clock, BarChart2, Calendar, ArrowLeft, Inbox,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

// Single source of truth for the admin-panel sidebar nav. Used by:
//   - app/admin/page.js          (tabs mode — clicks set activeTab in-page)
//   - app/lynq-admin/layout.js   (links mode — clicks navigate to /admin?tab=)
const NAV = [
  { group: 'OVERVIEW', items: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ]},
  { group: 'CLIENTS', items: [
    { id: 'clients',       label: 'Clients',       icon: Users,    badge: 'clientCount' },
    { id: 'create-client', label: 'Create Client', icon: UserPlus },
  ]},
  { group: 'COMMUNICATION', items: [
    { id: 'broadcasts',    label: 'Broadcasts',    icon: Radio },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'inquiries',     label: 'Inquiries',     icon: MessageSquare, badge: 'newInquiries' },
  ]},
  { group: 'TEAM', items: [
    { id: 'team', label: 'Team Members', icon: UserCheck },
    { id: 'time', label: 'Time Tracking', icon: Clock },
  ]},
  { group: 'FINANCE', items: [
    { id: 'finance', label: 'Finance', icon: BarChart2 },
    { id: 'events',  label: 'Events',  icon: Calendar },
  ]},
]

const CSS = `
  .as-root { display:flex; flex-direction:column; flex-shrink:0; height:100vh; width:220px; background:#0D0F14; font-family:'Switzer',-apple-system,BlinkMacSystemFont,sans-serif; -webkit-font-smoothing:antialiased; box-sizing:border-box; }
  .as-root *, .as-root *::before, .as-root *::after { box-sizing:border-box; }

  .as-header { padding:18px 16px; border-bottom:1px solid rgba(255,255,255,0.06); }
  .as-header-tag { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.12em; color:rgba(255,255,255,0.25); margin-bottom:2px; }
  .as-header-title { font-size:13px; font-weight:600; color:#FFFFFF; }

  .as-scroll { padding:8px 8px; flex:1; overflow-y:auto; }
  .as-group-label { font-size:9px; text-transform:uppercase; letter-spacing:0.1em; color:rgba(255,255,255,0.2); padding:12px 8px 4px; }

  .as-nav-item {
    display:flex; align-items:center; gap:8px;
    padding:7px 8px; border-radius:6px;
    font-size:12.5px; color:rgba(255,255,255,0.4);
    cursor:pointer; margin-bottom:1px;
    transition:all 0.12s; border:none; background:none;
    width:100%; text-align:left;
    font-family:'Switzer',-apple-system,BlinkMacSystemFont,sans-serif;
    border-left:2.5px solid transparent;
    text-decoration:none;
  }
  .as-nav-item:hover { background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.7); }
  .as-nav-item.active {
    background:rgba(139,92,246,0.14); color:#C4B5FD; font-weight:500;
    border-left-color:#8B5CF6; padding-left:5.5px;
  }
  .as-nav-item.active svg { opacity:1 !important; color:#A175FC; }

  .as-badge {
    font-size:10px; font-weight:700; border-radius:100px;
    padding:1px 6px; line-height:1.5; flex-shrink:0;
  }
  .as-badge-default  { background:rgba(255,255,255,0.1); color:rgba(255,255,255,0.5); }
  .as-badge-warning  { background:#f87171; color:#fff; }
  .as-badge-iris     { background:#A175FC; color:#FFFFFF; }

  .as-footer { padding:12px 10px; border-top:1px solid rgba(255,255,255,0.06); }
  .as-footer a {
    display:flex; align-items:center; gap:6px;
    text-decoration:none; color:rgba(255,255,255,0.35);
    font-size:12px; transition:color .15s;
  }
  .as-footer a:hover { color:rgba(255,255,255,0.6); }
`

export default function AdminSidebar({
  activeTab,
  onTabChange,            // when set → tabs mode; otherwise → links mode
  clientCount = 0,
  newInquiriesCount = 0,
}) {
  const pathname = usePathname() || ''
  const tabsMode = typeof onTabChange === 'function'

  // Only the Feedback sub-item is a route — its active state is URL-based.
  const feedbackActive = pathname.startsWith('/lynq-admin/feedback')

  // Feedback count is fetched here so both call sites stay in sync.
  // Only meaningful for the admin user (info@lynqagency.com), and the
  // /api/lynq-admin/feedback/count endpoint enforces that server-side.
  const [feedbackCount, setFeedbackCount] = useState(0)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/lynq-admin/feedback/count', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      })
      if (cancelled) return
      if (res.ok) {
        const d = await res.json().catch(() => ({}))
        if (typeof d.count === 'number') setFeedbackCount(d.count)
      }
    })()
    return () => { cancelled = true }
  }, [])

  function badgeFor(badgeKey) {
    if (badgeKey === 'clientCount')  return clientCount
    if (badgeKey === 'newInquiries') return newInquiriesCount
    return 0
  }

  return (
    <aside className="as-root">
      <style>{CSS}</style>

      <div className="as-header">
        <div className="as-header-tag">ADMIN</div>
        <div className="as-header-title">Lynq &amp; Flow</div>
      </div>

      <nav className="as-scroll">
        {NAV.map(({ group, items }) => (
          <div key={group}>
            <div className="as-group-label">{group}</div>
            {items.map(({ id, label, icon: Icon, badge }) => {
              const isActive = tabsMode && activeTab === id
              const count = badgeFor(badge)
              const inner = (
                <>
                  <Icon size={15} strokeWidth={1.75} style={{ opacity: isActive ? 1 : 0.5, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{label}</span>
                  {count > 0 && (
                    <span className={`as-badge ${badge === 'newInquiries' ? 'as-badge-warning' : 'as-badge-default'}`}>
                      {count}
                    </span>
                  )}
                </>
              )
              if (tabsMode) {
                return (
                  <button
                    key={id}
                    className={`as-nav-item${isActive ? ' active' : ''}`}
                    onClick={() => onTabChange(id)}
                    type="button"
                  >
                    {inner}
                  </button>
                )
              }
              return (
                <Link
                  key={id}
                  href={`/admin?tab=${id}`}
                  className="as-nav-item"
                >
                  {inner}
                </Link>
              )
            })}
          </div>
        ))}

        {/* SUPPORT — always a real route, active by pathname. */}
        <div>
          <div className="as-group-label">SUPPORT</div>
          <Link
            href="/lynq-admin/feedback"
            className={`as-nav-item${feedbackActive ? ' active' : ''}`}
          >
            <Inbox size={15} strokeWidth={1.75} style={{ opacity: feedbackActive ? 1 : 0.5, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>Feedback</span>
            {feedbackCount > 0 && (
              <span className="as-badge as-badge-iris">{feedbackCount}</span>
            )}
          </Link>
        </div>
      </nav>

      <div className="as-footer">
        <a href="/home">
          <ArrowLeft size={13} strokeWidth={1.75} />
          Back to Dashboard
        </a>
      </div>
    </aside>
  )
}
