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
  @keyframes liveRing {
    0%,100% { transform:scale(1); opacity:.7 }
    50%      { transform:scale(1.9); opacity:0 }
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
    width:64px; z-index:50; overflow:hidden;
    background:var(--sidebar-bg);
    border-right:1px solid var(--sidebar-border);
    display:flex; flex-direction:column;
    padding:16px 0 16px;
    font-family:var(--font-rethink),-apple-system,BlinkMacSystemFont,sans-serif;
    -webkit-font-smoothing:antialiased;
    transition:width .28s cubic-bezier(.16,1,.3,1), box-shadow .28s;
  }
  .sb-root:hover {
    width:236px;
    box-shadow:8px 0 32px rgba(0,0,0,0.08);
  }
  [data-theme="dark"] .sb-root:hover {
    box-shadow:8px 0 40px rgba(0,0,0,0.45);
  }

  /* Top accent line */
  .sb-root::before {
    content:''; position:absolute;
    top:0; left:0; right:0; height:1px;
    background:linear-gradient(90deg,transparent 0%,var(--accent-border) 50%,transparent 100%);
  }

  /* ── Logo ── */
  .sb-logo {
    padding:0 0 18px 20px;
    display:flex; align-items:center;
    flex-shrink:0; overflow:hidden;
  }
  .sb-logo-divider {
    height:1px; background:var(--divider);
    margin:0 10px 14px; flex-shrink:0;
  }

  /* ── Section label ── */
  .sb-section-label {
    font-size:9px; font-weight:700; letter-spacing:.12em;
    text-transform:uppercase; color:var(--sidebar-section-label);
    padding:0 20px; margin:14px 0 3px;
    user-select:none; white-space:nowrap;
    opacity:0; transition:opacity .18s;
  }
  .sb-root:hover .sb-section-label { opacity:1 }

  .sb-section-divider {
    height:1px; background:var(--divider);
    margin:10px; flex-shrink:0;
    opacity:1; transition:opacity .18s;
  }
  .sb-root:hover .sb-section-divider { opacity:0; height:0; margin:0 }

  /* ── Nav item ── */
  .sb-item {
    display:flex; align-items:center;
    padding:8px 0 8px 20px; gap:11px;
    border-radius:10px; margin:1px 8px;
    text-decoration:none; cursor:pointer;
    position:relative; user-select:none; white-space:nowrap;
    transition:background .15s;
  }
  .sb-item:hover:not(.sb-locked):not(.sb-active) {
    background:var(--sidebar-hover);
  }
  .sb-item.sb-active {
    background:var(--sidebar-active-bg);
    box-shadow:inset 0 0 0 1px var(--sidebar-active-border);
  }
  .sb-item.sb-locked { cursor:default; pointer-events:none; }

  /* Active left bar */
  .sb-item.sb-active::before {
    content:''; position:absolute; left:0; top:50%;
    transform:translateY(-50%);
    width:3px; height:18px; border-radius:0 3px 3px 0;
    background:var(--accent-gradient);
    box-shadow:0 0 8px var(--accent-border);
  }

  /* ── Icon ── */
  .sb-icon {
    display:flex; align-items:center; justify-content:center;
    width:20px; flex-shrink:0; position:relative;
  }

  /* ── Label ── */
  .sb-label {
    font-size:13.5px; font-weight:500; letter-spacing:.005em;
    flex:1; white-space:nowrap; overflow:hidden;
    opacity:0; transform:translateX(-6px);
    transition:opacity .18s .05s, transform .22s .05s;
    pointer-events:none;
  }
  .sb-item.sb-active .sb-label { font-weight:600 }
  .sb-root:hover .sb-label { opacity:1; transform:translateX(0); pointer-events:auto }

  /* ── Lock badge ── */
  .sb-lock {
    width:17px; height:17px; border-radius:5px;
    background:var(--bg-surface-2);
    display:flex; align-items:center; justify-content:center;
    flex-shrink:0; margin-right:4px;
    opacity:0; transition:opacity .15s;
  }
  .sb-root:hover .sb-lock { opacity:1 }

  /* ── Live dot (academy badge) ── */
  .sb-badge {
    position:absolute; top:-2px; right:-2px;
    width:7px; height:7px; border-radius:50%;
    background:#4ade80; border:1.5px solid var(--sidebar-bg);
  }
  .sb-badge::after {
    content:''; position:absolute; inset:0; border-radius:50%;
    background:#4ade80;
    animation:liveRing 2.4s ease-out infinite;
  }

  /* ── Divider ── */
  .sb-divider {
    height:1px; background:var(--divider); margin:12px 10px; flex-shrink:0;
  }

  /* ── User row ── */
  .sb-user {
    display:flex; align-items:center; gap:10px;
    padding:8px 0 8px 16px; border-radius:10px; margin:0 8px;
    cursor:default; overflow:hidden; transition:background .15s;
  }
  .sb-user:hover { background:var(--sidebar-hover) }

  .sb-avatar {
    width:32px; height:32px; border-radius:10px;
    background:var(--accent-gradient);
    display:flex; align-items:center; justify-content:center;
    font-size:12px; font-weight:700; color:#fff; flex-shrink:0;
    box-shadow:0 0 0 2px var(--accent-border);
    animation:avatarPop .5s cubic-bezier(.16,1,.3,1) .3s both;
    letter-spacing:.02em;
  }

  .sb-user-info {
    flex:1; min-width:0;
    opacity:0; transform:translateX(-6px);
    transition:opacity .18s .05s, transform .22s .05s;
  }
  .sb-root:hover .sb-user-info { opacity:1; transform:translateX(0) }

  .sb-user-name {
    font-size:12.5px; font-weight:600; color:var(--text-1);
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.3;
  }
  .sb-user-status {
    display:flex; align-items:center; gap:5px;
    font-size:10.5px; color:var(--text-3); margin-top:1px;
  }
  .sb-online-dot {
    width:6px; height:6px; border-radius:50%; background:#4ade80; flex-shrink:0;
  }

  .sb-logout {
    background:transparent; border:none; padding:5px; border-radius:7px;
    color:var(--text-3); cursor:pointer; flex-shrink:0;
    display:flex; align-items:center; justify-content:center;
    transition:color .15s, background .15s;
    opacity:0; pointer-events:none; margin-right:4px;
  }
  .sb-root:hover .sb-logout { opacity:1; pointer-events:auto }
  .sb-logout:hover { color:var(--text-2); background:var(--sidebar-hover) }

  /* ── Theme toggle ── */
  .sb-theme-btn {
    display:flex; align-items:center; justify-content:center;
    width:32px; height:32px; border-radius:9px; flex-shrink:0;
    background:var(--bg-surface-2); border:1px solid var(--border);
    color:var(--text-2); cursor:pointer;
    transition:color .15s, background .15s, border-color .15s;
    opacity:0; pointer-events:none; margin-right:4px;
  }
  .sb-root:hover .sb-theme-btn { opacity:1; pointer-events:auto }
  .sb-theme-btn:hover { color:var(--accent); background:var(--accent-soft); border-color:var(--accent-border) }
`

const TOP_ITEMS = [
  {
    section: null,
    href: '/home', label: 'Home',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  },
  {
    section: 'Support',
    href: '/inbox', label: 'Inbox',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>,
  },
  {
    section: null,
    href: '/analytics', label: 'Analytics',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
  },
  {
    section: null,
    href: '/performance', label: 'Performance',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
  },
  {
    section: 'Operations',
    href: '/time-tracking', label: 'Time Tracking',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  },
  {
    section: null,
    href: '/value-feed', label: 'Value Feed',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  },
  {
    section: null,
    href: '/supply-chain', label: 'Supply Chain',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  },
  {
    section: 'Learn',
    href: '/academy', label: 'Academy', badge: true,
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
  },
  {
    section: null,
    href: '/services', label: 'Services',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
]

const BOTTOM_ITEMS = [
  {
    href: '/feedback', label: 'Feedback',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  },
  {
    href: '/settings', label: 'Settings',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  },
]

const LOCK_SVG = (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--text-3)">
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
        ? pathname === '/inbox'
        : pathname.startsWith(item.href)
    )
    const iconColor  = active ? 'var(--sidebar-icon-active)'    : item.locked ? 'var(--text-3)' : 'var(--sidebar-icon-inactive)'
    const labelColor = active ? 'var(--sidebar-label-active)'   : item.locked ? 'var(--text-3)' : 'var(--sidebar-label-inactive)'
    const inner = (
      <>
        <span className="sb-icon" title={item.label}>
          <span style={{ color: iconColor, display: 'flex', transition: 'color .15s' }}>{item.icon}</span>
          {item.badge && <span className="sb-badge" />}
        </span>
        <span className="sb-label" style={{ color: labelColor }}>{item.label}</span>
        {item.locked && <span className="sb-lock">{LOCK_SVG}</span>}
      </>
    )
    return item.href
      ? <Link key={item.label} href={item.href} className={`sb-item${active ? ' sb-active' : ''}`}>{inner}</Link>
      : <div key={item.label} className="sb-item sb-locked">{inner}</div>
  }

  const SunIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  )
  const MoonIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )

  return (
    <>
      <style>{CSS}</style>
      <div style={{ width: 64, flexShrink: 0 }} />

      <aside className="sb-root">
        {/* Logo */}
        <div className="sb-logo">
          <img
            src="/logo.png"
            alt="Lynq"
            style={{ height: 24, maxWidth: 'none', objectFit: 'contain', objectPosition: 'left center', filter: 'var(--sidebar-logo-filter)', flexShrink: 0 }}
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
        </div>
        <div className="sb-logo-divider" />

        {/* Nav */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1 }}>
            {TOP_ITEMS.map((item) => {
              const showSection = item.section && item.section !== prevSection
              prevSection = item.section ?? prevSection
              return (
                <div key={item.label}>
                  {showSection && (
                    <>
                      <div className="sb-section-divider" />
                      <div className="sb-section-label">{item.section}</div>
                    </>
                  )}
                  {renderItem(item)}
                </div>
              )
            })}
          </div>

          <div>
            <div className="sb-section-divider" />
            {BOTTOM_ITEMS.map(item => renderItem(item))}
            {isAdmin && (
              <Link href="/admin" className={`sb-item${pathname.startsWith('/admin') ? ' sb-active' : ''}`}>
                <span className="sb-icon" title="Admin Panel">
                  <span style={{ color: pathname.startsWith('/admin') ? 'var(--sidebar-icon-active)' : 'var(--sidebar-icon-inactive)', display: 'flex', transition: 'color .15s' }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          <button className="sb-theme-btn" onClick={toggle} aria-label="Toggle theme" title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
            {theme === 'light' ? <MoonIcon /> : <SunIcon />}
          </button>
          <button className="sb-logout" onClick={logout} aria-label="Log out" title="Log out">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    <Suspense fallback={<div style={{ width: 64, flexShrink: 0 }} />}>
      <SidebarContent />
    </Suspense>
  )
}
