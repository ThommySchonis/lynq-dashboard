'use client'

import { usePathname } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const nav = [
  { href: '/inbox',         icon: '✉️',  label: 'Inbox' },
  { href: '/supply-chain',  icon: '📦',  label: 'Supply Chain' },
  { href: '/macros',        icon: '⚡',  label: 'Macros' },
  { href: '/analytics',     icon: '📊',  label: 'Analytics' },
  { href: '/services',      icon: '👥',  label: 'Services' },
  { href: '/settings',      icon: '⚙️',  label: 'Settings' },
]

export default function Sidebar() {
  const pathname = usePathname()

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <aside style={{
      width: '220px',
      minHeight: '100vh',
      background: '#1a0d30',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 12px',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '8px 12px 24px' }}>
        <img
          src="/logo.png"
          alt="Lynq"
          style={{ height: '24px', filter: 'brightness(0) invert(1)' }}
        />
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {nav.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <a
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: active ? '600' : '400',
                color: active ? '#fff' : 'rgba(255,255,255,0.45)',
                background: active ? 'rgba(161,117,252,0.15)' : 'transparent',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
                borderLeft: active ? '2px solid #A175FC' : '2px solid transparent',
              }}
              onMouseEnter={e => {
                if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.75)'
              }}
              onMouseLeave={e => {
                if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.45)'
              }}
            >
              <span style={{ fontSize: '15px', width: '20px', textAlign: 'center' }}>
                {item.icon}
              </span>
              {item.label}
            </a>
          )
        })}
      </nav>

      {/* Bottom */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '9px 12px',
            borderRadius: '8px',
            fontSize: '13px',
            color: 'rgba(255,255,255,0.35)',
            background: 'transparent',
            cursor: 'pointer',
            textAlign: 'left',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}
        >
          <span style={{ fontSize: '15px', width: '20px', textAlign: 'center' }}>↩</span>
          Sign out
        </button>
      </div>
    </aside>
  )
}
