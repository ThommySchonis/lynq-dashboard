'use client'

import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const NAV_ITEMS = [
  {
    href: '/home',
    label: 'Home',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: '/inbox',
    label: 'Inbox',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
        <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
      </svg>
    ),
  },
  {
    href: '/analytics',
    label: 'Analytics',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
        <line x1="2" y1="20" x2="22" y2="20"/>
      </svg>
    ),
  },
  {
    href: '/performance',
    label: 'Performance',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
        <polyline points="16 7 22 7 22 13"/>
      </svg>
    ),
  },
  {
    href: null,
    label: 'Time Tracking',
    locked: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  {
    href: '/value-feed',
    label: 'Value Feed',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    href: null,
    label: 'Supply Chain',
    locked: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
  },
  {
    href: '/academy',
    label: 'Academy',
    badge: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
        <path d="M6 12v5c3 3 9 3 12 0v-5"/>
      </svg>
    ),
  },
  {
    href: '/services',
    label: 'Services',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    href: '/feedback',
    label: 'Feedback',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
]

const LOCK_ICON = (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17 11V7A5 5 0 0 0 7 7v4H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2zm-5 6.72V16a1 1 0 0 1 2 0v1.72a1 1 0 1 1-2 0zM9 11V7a3 3 0 0 1 6 0v4H9z"/>
  </svg>
)

export default function Sidebar() {
  const pathname = usePathname()
  const [userEmail, setUserEmail] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserEmail(session.user.email || '')
        setIsAdmin(session.user.email === 'info@lynqagency.com')
      }
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const initials = userEmail
    ? userEmail.split('@')[0].slice(0, 2).toUpperCase()
    : '?'

  return (
    <aside style={{
      width: '220px',
      minHeight: '100vh',
      background: '#060D18',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 12px',
      flexShrink: 0,
      position: 'relative',
    }}>
      {/* Logo */}
      <div style={{ padding: '4px 8px', marginBottom: '28px' }}>
        <img
          src="/logo.png"
          alt="Lynq"
          style={{ height: '28px', filter: 'brightness(0) invert(1)', objectFit: 'contain' }}
          onError={e => { e.target.style.display = 'none' }}
        />
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {NAV_ITEMS.map(item => {
          const active = item.href && pathname.startsWith(item.href)
          const isLocked = item.locked

          const content = (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '9px 10px',
              borderRadius: '9px',
              cursor: isLocked ? 'default' : 'pointer',
              transition: 'all 0.15s ease',
              background: active
                ? 'rgba(48,136,255,0.15)'
                : 'transparent',
              color: active
                ? '#3088FF'
                : isLocked
                  ? 'rgba(255,255,255,0.2)'
                  : 'rgba(255,255,255,0.5)',
              position: 'relative',
              userSelect: 'none',
            }}
            onMouseEnter={e => {
              if (!active && !isLocked) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                e.currentTarget.style.color = 'rgba(255,255,255,0.85)'
              }
            }}
            onMouseLeave={e => {
              if (!active && !isLocked) {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
              }
            }}
            >
              {/* Active bar */}
              {active && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '3px',
                  height: '18px',
                  borderRadius: '0 2px 2px 0',
                  background: '#3088FF',
                }} />
              )}

              {/* Icon */}
              <span style={{ flexShrink: 0, display: 'flex', position: 'relative' }}>
                {item.icon}
                {item.badge && (
                  <span style={{
                    position: 'absolute',
                    top: '-3px',
                    right: '-3px',
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: '#4ade80',
                    border: '1.5px solid #060D18',
                  }} />
                )}
              </span>

              {/* Label */}
              <span style={{
                fontSize: '13px',
                fontWeight: active ? '600' : '400',
                letterSpacing: '0.01em',
                flex: 1,
              }}>
                {item.label}
              </span>

              {/* Lock icon */}
              {isLocked && (
                <span style={{ opacity: 0.4, flexShrink: 0 }}>
                  {LOCK_ICON}
                </span>
              )}
            </div>
          )

          if (isLocked) {
            return <div key={item.label}>{content}</div>
          }

          return (
            <a
              key={item.href}
              href={item.href}
              style={{ textDecoration: 'none', display: 'block' }}
            >
              {content}
            </a>
          )
        })}

        {/* Admin Panel — only shown to admin */}
        {isAdmin && (
          <a href="/admin" style={{ textDecoration: 'none', display: 'block', marginTop: '4px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '9px 10px',
              borderRadius: '9px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              background: pathname.startsWith('/admin') ? 'rgba(48,136,255,0.15)' : 'transparent',
              color: pathname.startsWith('/admin') ? '#3088FF' : 'rgba(255,255,255,0.5)',
            }}
            onMouseEnter={e => {
              if (!pathname.startsWith('/admin')) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                e.currentTarget.style.color = 'rgba(255,255,255,0.85)'
              }
            }}
            onMouseLeave={e => {
              if (!pathname.startsWith('/admin')) {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
              }
            }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span style={{ fontSize: '13px', fontWeight: '400', letterSpacing: '0.01em' }}>
                Admin Panel
              </span>
            </div>
          </a>
        )}
      </nav>

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '12px 0' }} />

      {/* User + logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 8px' }}>
        {/* Avatar */}
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #3088FF 0%, #FF6B35 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
          fontWeight: '700',
          color: '#fff',
          flexShrink: 0,
        }}>
          {initials}
        </div>

        {/* Email truncated */}
        <span style={{
          fontSize: '12px',
          color: 'rgba(255,255,255,0.4)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '110px',
        }}>
          {userEmail || 'Loading…'}
        </span>

        {/* Logout */}
        <button
          onClick={handleLogout}
          title="Sign out"
          style={{
            background: 'transparent',
            padding: '4px',
            borderRadius: '6px',
            color: 'rgba(255,255,255,0.3)',
            cursor: 'pointer',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </aside>
  )
}
