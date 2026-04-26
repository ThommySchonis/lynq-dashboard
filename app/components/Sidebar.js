'use client'

import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const CSS = `
  @keyframes sidebarIn {
    from { opacity:0; transform:translateX(-8px); }
    to   { opacity:1; transform:translateX(0); }
  }
  @keyframes avatarPop {
    from { transform:scale(.85); opacity:0; }
    to   { transform:scale(1);   opacity:1; }
  }
  @keyframes liveRing {
    0%,100% { transform:scale(1); opacity:.8; }
    50%      { transform:scale(1.7); opacity:0; }
  }

  @media (prefers-reduced-motion:reduce) {
    .sb-root *, .sb-root *::before, .sb-root *::after {
      animation-duration:.01ms !important;
      transition-duration:.01ms !important;
    }
  }

  .sb-root {
    width:220px; min-height:100vh; flex-shrink:0;
    background:rgba(6,9,26,0.98);
    border-right:1px solid rgba(255,255,255,0.055);
    display:flex; flex-direction:column;
    padding:20px 10px 20px;
    font-family:var(--font-rethink),-apple-system,BlinkMacSystemFont,sans-serif;
    -webkit-font-smoothing:antialiased;
    backdrop-filter:blur(20px);
    -webkit-backdrop-filter:blur(20px);
    position:relative; z-index:10;
  }

  /* Subtle top-edge highlight */
  .sb-root::before {
    content:'';
    position:absolute;
    top:0; left:0; right:0; height:1px;
    background:linear-gradient(90deg,transparent,rgba(48,136,255,0.2),transparent);
  }

  .sb-logo {
    padding:4px 10px 24px;
    animation:sidebarIn .5s cubic-bezier(.16,1,.3,1) both;
  }

  /* Section label */
  .sb-section-label {
    font-size:9.5px; font-weight:700; letter-spacing:.1em;
    text-transform:uppercase; color:rgba(248,250,252,0.2);
    padding:0 10px; margin:12px 0 4px;
    user-select:none;
  }

  /* Nav item */
  .sb-item {
    display:flex; align-items:center; gap:10px;
    padding:8px 10px; border-radius:10px;
    text-decoration:none; cursor:pointer;
    transition:background .15s ease, color .15s ease, box-shadow .15s ease;
    position:relative; user-select:none;
  }
  .sb-item:hover:not(.sb-locked):not(.sb-active) {
    background:rgba(255,255,255,0.05);
  }
  .sb-item.sb-active {
    background:rgba(48,136,255,0.12);
    box-shadow:inset 0 0 0 1px rgba(48,136,255,0.18);
  }
  .sb-item.sb-locked {
    cursor:default;
    pointer-events:none;
  }

  /* Active left accent bar */
  .sb-item.sb-active::before {
    content:'';
    position:absolute; left:0; top:50%;
    transform:translateY(-50%);
    width:3px; height:16px;
    border-radius:0 3px 3px 0;
    background:linear-gradient(180deg,#3088FF,#60A5FA);
  }

  .sb-icon {
    display:flex; align-items:center; justify-content:center;
    width:20px; flex-shrink:0; position:relative;
  }
  .sb-label {
    font-size:13px; font-weight:400; letter-spacing:.005em;
    flex:1; white-space:nowrap;
  }
  .sb-item.sb-active .sb-label { font-weight:600; }

  /* Lock badge */
  .sb-lock {
    width:16px; height:16px; border-radius:5px;
    background:rgba(255,255,255,0.06);
    display:flex; align-items:center; justify-content:center;
    flex-shrink:0;
  }

  /* Green dot badge */
  .sb-badge {
    position:absolute; top:-2px; right:-2px;
    width:7px; height:7px; border-radius:50%;
    background:#4ade80;
    border:1.5px solid rgba(6,9,26,0.98);
  }
  .sb-badge::after {
    content:''; position:absolute; inset:0; border-radius:50%;
    background:#4ade80;
    animation:liveRing 2.2s ease-out infinite;
  }

  /* Bottom user row */
  .sb-user {
    display:flex; align-items:center; gap:9px;
    padding:8px 10px; border-radius:10px;
    cursor:default;
    transition:background .15s ease;
  }
  .sb-user:hover { background:rgba(255,255,255,0.04); }

  .sb-avatar {
    width:30px; height:30px; border-radius:'50%';
    background:linear-gradient(135deg,#3088FF 0%,#FF6B35 100%);
    display:flex; align-items:center; justify-content:center;
    font-size:11px; font-weight:700; color:#fff; flex-shrink:0;
    animation:avatarPop .5s cubic-bezier(.16,1,.3,1) .3s both;
    border-radius:50%;
  }
  .sb-email {
    font-size:11.5px; color:rgba(248,250,252,0.35);
    flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  }
  .sb-logout {
    background:transparent; border:none; padding:4px; border-radius:6px;
    color:rgba(248,250,252,0.25); cursor:pointer; flex-shrink:0;
    display:flex; align-items:center; justify-content:center;
    transition:color .15s ease, background .15s ease;
  }
  .sb-logout:hover { color:rgba(248,250,252,0.65); background:rgba(255,255,255,0.06); }

  .sb-divider {
    height:1px; background:rgba(255,255,255,0.055); margin:10px 0;
  }
`

const ITEMS = [
  {
    section: null,
    href: '/home', label: 'Home',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  },
  {
    section: 'Support',
    href: '/inbox', label: 'Inbox',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>,
  },
  {
    section: null,
    href: '/analytics', label: 'Analytics',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
  },
  {
    section: null,
    href: '/performance', label: 'Performance',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
  },
  {
    section: 'Operations',
    href: null, label: 'Time Tracking', locked: true,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  },
  {
    section: null,
    href: '/value-feed', label: 'Value Feed',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  },
  {
    section: null,
    href: null, label: 'Supply Chain', locked: true,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  },
  {
    section: 'Learn',
    href: '/academy', label: 'Academy', badge: true,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
  },
  {
    section: null,
    href: '/services', label: 'Services',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
  {
    section: 'Account',
    href: '/feedback', label: 'Feedback',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  },
  {
    section: null,
    href: '/settings', label: 'Settings',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  },
]

const LOCK_SVG = (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(248,250,252,0.25)">
    <path d="M17 11V7A5 5 0 0 0 7 7v4H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2zM12 17.72V16a1 1 0 0 1 2 0v1.72a1 1 0 1 1-2 0zM9 11V7a3 3 0 0 1 6 0v4H9z"/>
  </svg>
)

export default function Sidebar() {
  const pathname   = usePathname()
  const [email, setEmail]     = useState('')
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

  const initials = email ? email.split('@')[0].slice(0, 2).toUpperCase() : '?'

  let prevSection = undefined

  return (
    <aside className="sb-root">
      <style>{CSS}</style>

      {/* Logo */}
      <div className="sb-logo">
        <img
          src="/logo.png"
          alt="Lynq"
          style={{ height: 26, filter: 'brightness(0) invert(1)', objectFit: 'contain' }}
          onError={e => { e.currentTarget.style.display = 'none' }}
        />
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {ITEMS.map((item, idx) => {
          const showSection = item.section && item.section !== prevSection
          prevSection = item.section ?? prevSection
          const active = item.href && pathname.startsWith(item.href)
          const delay  = idx * 30

          const inner = (
            <>
              <span className="sb-icon">
                <span style={{ color: active ? '#60A5FA' : item.locked ? 'rgba(248,250,252,0.18)' : 'rgba(248,250,252,0.38)', display: 'flex', transition: 'color .15s' }}>
                  {item.icon}
                </span>
                {item.badge && <span className="sb-badge" />}
              </span>
              <span className="sb-label" style={{ color: active ? '#F8FAFC' : item.locked ? 'rgba(248,250,252,0.22)' : 'rgba(248,250,252,0.6)' }}>
                {item.label}
              </span>
              {item.locked && <span className="sb-lock">{LOCK_SVG}</span>}
            </>
          )

          return (
            <div key={item.label} style={{ animation: `sidebarIn .4s cubic-bezier(.16,1,.3,1) ${delay}ms both` }}>
              {showSection && <div className="sb-section-label">{item.section}</div>}
              {item.href
                ? <a href={item.href} className={`sb-item${active ? ' sb-active' : ''}`}>{inner}</a>
                : <div className={`sb-item sb-locked`}>{inner}</div>
              }
            </div>
          )
        })}

        {/* Admin Panel */}
        {isAdmin && (
          <div style={{ animation: `sidebarIn .4s cubic-bezier(.16,1,.3,1) ${ITEMS.length * 30}ms both` }}>
            <div className="sb-section-label">Admin</div>
            <a href="/admin" className={`sb-item${pathname.startsWith('/admin') ? ' sb-active' : ''}`}>
              <span className="sb-icon">
                <span style={{ color: pathname.startsWith('/admin') ? '#60A5FA' : 'rgba(248,250,252,0.38)', display: 'flex', transition: 'color .15s' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </span>
              </span>
              <span className="sb-label" style={{ color: pathname.startsWith('/admin') ? '#F8FAFC' : 'rgba(248,250,252,0.6)' }}>Admin Panel</span>
            </a>
          </div>
        )}
      </nav>

      <div className="sb-divider" />

      {/* User row */}
      <div className="sb-user">
        <div className="sb-avatar">{initials}</div>
        <span className="sb-email">{email || '—'}</span>
        <button
          className="sb-logout"
          onClick={logout}
          aria-label="Sign out"
          title="Sign out"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </aside>
  )
}
