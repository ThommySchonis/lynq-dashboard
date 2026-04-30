'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, Suspense } from 'react'
import { supabase } from '../../lib/supabase'
import { useTheme } from './ThemeProvider'

const CSS = `
  @keyframes avatarPop {
    from { transform:scale(.8); opacity:0 }
    to   { transform:scale(1);  opacity:1 }
  }

  @media (prefers-reduced-motion:reduce) {
    .sb-root *, .sb-root *::before, .sb-root *::after {
      animation-duration:.01ms !important;
      transition-duration:.01ms !important;
    }
  }

  /* ── Root ── */
  .sb-root {
    position:fixed; left:0; top:0; bottom:0;
    width:200px; z-index:50; overflow:hidden;
    background:var(--sidebar-bg);
    border-right:1px solid var(--sidebar-border);
    display:flex; flex-direction:column;
    padding:14px 0 14px;
    font-family:var(--font-rethink),-apple-system,BlinkMacSystemFont,sans-serif;
    -webkit-font-smoothing:antialiased;
  }

  /* ── Logo ── */
  .sb-logo {
    padding:0 14px 14px;
    display:flex; align-items:center; gap:9px;
    flex-shrink:0;
  }
  .sb-logo-mark {
    width:22px; height:22px; border-radius:6px;
    background:#111111; display:flex; align-items:center; justify-content:center;
    flex-shrink:0;
  }
  .sb-logo-text {
    font-size:13.5px; font-weight:700; color:var(--sidebar-label-active); letter-spacing:-.01em;
  }
  .sb-logo-divider {
    height:1px; background:var(--divider);
    margin:0 14px 10px; flex-shrink:0;
  }

  /* ── Section label ── */
  .sb-section-label {
    font-size:9px; font-weight:700; letter-spacing:.12em;
    text-transform:uppercase; color:var(--sidebar-section-label);
    padding:0 16px; margin:12px 0 2px;
    user-select:none; white-space:nowrap;
  }

  /* ── Nav item ── */
  .sb-item {
    display:flex; align-items:center;
    padding:7px 10px 7px 14px; gap:9px;
    border-radius:8px; margin:1px 6px;
    text-decoration:none; cursor:pointer;
    position:relative; user-select:none; white-space:nowrap;
    transition:background .12s;
    border-left:2px solid transparent;
  }
  .sb-item:hover:not(.sb-locked):not(.sb-active) {
    background:var(--sidebar-hover);
  }
  .sb-item.sb-active {
    background:var(--sidebar-active-bg);
    border-left-color:var(--sidebar-active-border);
    border-radius:0 8px 8px 0;
    margin-left:0;
    padding-left:20px;
  }
  .sb-item.sb-locked { cursor:default; pointer-events:none; }

  /* ── Icon ── */
  .sb-icon {
    display:flex; align-items:center; justify-content:center;
    width:18px; flex-shrink:0; position:relative;
  }

  /* ── Label ── */
  .sb-label {
    font-size:13px; font-weight:500; letter-spacing:.005em;
    flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  .sb-item.sb-active .sb-label { font-weight:600 }

  /* ── Unread badge ── */
  .sb-unread {
    min-width:17px; height:17px; border-radius:100px;
    background:#111111; color:#fff;
    display:flex; align-items:center; justify-content:center;
    font-size:9.5px; font-weight:700; padding:0 5px;
    flex-shrink:0;
  }

  /* ── Lock badge ── */
  .sb-lock {
    width:16px; height:16px; border-radius:5px;
    background:var(--bg-surface-2);
    display:flex; align-items:center; justify-content:center;
    flex-shrink:0; margin-right:2px;
  }

  /* ── Divider ── */
  .sb-divider {
    height:1px; background:var(--divider); margin:10px 14px; flex-shrink:0;
  }

  /* ── User row ── */
  .sb-user {
    display:flex; align-items:center; gap:9px;
    padding:7px 6px 7px 14px;
    border-radius:8px; margin:0 6px;
    cursor:default; overflow:hidden; transition:background .12s;
  }
  .sb-user:hover { background:var(--sidebar-hover) }

  .sb-avatar {
    width:28px; height:28px; border-radius:8px;
    background:#111111;
    display:flex; align-items:center; justify-content:center;
    font-size:11px; font-weight:700; color:#fff; flex-shrink:0;
    animation:avatarPop .4s cubic-bezier(.16,1,.3,1) .2s both;
    letter-spacing:.02em;
  }

  .sb-user-info {
    flex:1; min-width:0;
  }
  .sb-user-name {
    font-size:12px; font-weight:600; color:var(--text-1);
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.3;
  }
  .sb-user-status {
    display:flex; align-items:center; gap:4px;
    font-size:10px; color:var(--text-3); margin-top:1px;
  }
  .sb-online-dot {
    width:5px; height:5px; border-radius:50%; background:#4ade80; flex-shrink:0;
  }

  .sb-icon-btn {
    background:transparent; border:none; padding:4px; border-radius:6px;
    color:var(--text-3); cursor:pointer; flex-shrink:0;
    display:flex; align-items:center; justify-content:center;
    transition:color .12s, background .12s;
  }
  .sb-icon-btn:hover { color:var(--text-2); background:var(--sidebar-hover) }
`

const TOP_ITEMS = [
  {
    section: null,
    href: '/home', label: 'Home',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  },
  {
    section: 'Support',
    href: '/inbox', label: 'Inbox', unread: 2,
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>,
  },
  {
    section: null,
    href: '/analytics', label: 'Analytics',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
  },
  {
    section: null,
    href: '/performance', label: 'Performance',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
  },
  {
    section: 'Operations',
    href: '/time-tracking', label: 'Time Tracking',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  },
  {
    section: null,
    href: '/value-feed', label: 'Value Feed',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  },
  {
    section: null,
    href: '/supply-chain', label: 'Supply Chain',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  },
  {
    section: 'Learn',
    href: '/academy', label: 'Academy',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
  },
  {
    section: null,
    href: '/services', label: 'Services',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
]

const BOTTOM_ITEMS = [
  {
    href: '/settings', label: 'Settings',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  },
]

const LOCK_SVG = (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="var(--text-3)">
    <path d="M17 11V7A5 5 0 0 0 7 7v4H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2zM9 11V7a3 3 0 0 1 6 0v4H9z"/>
  </svg>
)

function SidebarContent() {
  const pathname     = usePathname()
  const { theme, toggle } = useTheme()
  const [email, setEmail]   = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setEmail(session.user.email || '')
        setIsAdmin(session.user.email === 'info@lynqagency.com')
      }
    })
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const initials    = email ? email.split('@')[0].slice(0, 2).toUpperCase() : '?'
  const displayName = isAdmin ? 'Admin' : email ? email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—'

  let prevSection = undefined

  function renderItem(item) {
    const active = item.href && (
      item.href === '/inbox'
        ? pathname === '/inbox' || pathname.startsWith('/inbox/')
        : pathname.startsWith(item.href)
    )
    const iconColor  = active ? 'var(--sidebar-icon-active)'    : item.locked ? 'var(--text-3)' : 'var(--sidebar-icon-inactive)'
    const labelColor = active ? 'var(--sidebar-label-active)'   : item.locked ? 'var(--text-3)' : 'var(--sidebar-label-inactive)'
    const inner = (
      <>
        <span className="sb-icon">
          <span style={{ color: iconColor, display: 'flex', transition: 'color .12s' }}>{item.icon}</span>
        </span>
        <span className="sb-label" style={{ color: labelColor }}>{item.label}</span>
        {item.unread > 0 && !active && <span className="sb-unread">{item.unread}</span>}
        {item.locked && <span className="sb-lock">{LOCK_SVG}</span>}
      </>
    )
    return item.href
      ? <Link key={item.label} href={item.href} className={`sb-item${active ? ' sb-active' : ''}`}>{inner}</Link>
      : <div key={item.label} className="sb-item sb-locked">{inner}</div>
  }

  const SunIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  )
  const MoonIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )

  return (
    <>
      <style>{CSS}</style>
      <div style={{ width: 200, flexShrink: 0 }} />

      <aside className="sb-root">
        {/* Logo */}
        <div className="sb-logo">
          <div className="sb-logo-mark">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="sb-logo-text">Lynq & Flow</span>
        </div>
        <div className="sb-logo-divider" />

        {/* Nav */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', overflowY: 'auto' }}>
          <div style={{ flex: 1 }}>
            {TOP_ITEMS.map((item) => {
              const showSection = item.section && item.section !== prevSection
              prevSection = item.section ?? prevSection
              return (
                <div key={item.label}>
                  {showSection && (
                    <div className="sb-section-label">{item.section}</div>
                  )}
                  {renderItem(item)}
                </div>
              )
            })}
          </div>

          <div>
            <div className="sb-divider" />
            {BOTTOM_ITEMS.map(item => renderItem(item))}
            {isAdmin && (
              <Link href="/admin" className={`sb-item${pathname.startsWith('/admin') ? ' sb-active' : ''}`}>
                <span className="sb-icon">
                  <span style={{ color: pathname.startsWith('/admin') ? 'var(--sidebar-icon-active)' : 'var(--sidebar-icon-inactive)', display: 'flex', transition: 'color .12s' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                  </span>
                </span>
                <span className="sb-label" style={{ color: pathname.startsWith('/admin') ? 'var(--sidebar-label-active)' : 'var(--sidebar-label-inactive)' }}>Admin Panel</span>
              </Link>
            )}
          </div>
        </nav>

        <div className="sb-divider" />

        {/* User row */}
        <div className="sb-user">
          <div className="sb-avatar">{initials}</div>
          <div className="sb-user-info">
            <div className="sb-user-name">{displayName}</div>
            <div className="sb-user-status">
              <div className="sb-online-dot" />
              Online
            </div>
          </div>
          <button className="sb-icon-btn" onClick={toggle} aria-label="Toggle theme" title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
            {theme === 'light' ? <MoonIcon /> : <SunIcon />}
          </button>
          <button className="sb-icon-btn" onClick={logout} aria-label="Log out" title="Log out" style={{ marginRight: 2 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </aside>
    </>
  )
}

export default function Sidebar() {
  return (
    <Suspense fallback={<div style={{ width: 200, flexShrink: 0 }} />}>
      <SidebarContent />
    </Suspense>
  )
}
