'use client'

import { usePathname } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const nav = [
  { href: '/inbox',        icon: '✉️',  label: 'Inbox' },
  { href: '/supply-chain', icon: '📦',  label: 'Supply Chain' },
  { href: '/macros',       icon: '⚡',  label: 'Macros' },
  { href: '/analytics',    icon: '📊',  label: 'Analytics' },
  { href: '/services',     icon: '👥',  label: 'Services' },
  { href: '/settings',     icon: '⚙️',  label: 'Settings' },
]

export default function Sidebar() {
  const pathname = usePathname()

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <aside style={{
      width: '56px',
      minHeight: '100vh',
      background: '#160b2e',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '16px 0',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ marginBottom: '24px', padding: '4px' }}>
        <img src="/logo-icon.png" alt="Lynq" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '100%' }}>
        {nav.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <a
              key={item.href}
              href={item.href}
              title={item.label}
              style={{
                width: '40px', height: '40px', borderRadius: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px',
                background: active ? 'rgba(48,136,255,0.2)' : 'transparent',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
                opacity: active ? 1 : 0.45,
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.opacity = '0.8' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.opacity = '0.45' }}
            >
              {item.icon}
            </a>
          )
        })}
      </nav>

      {/* Logout */}
      <button
        onClick={handleLogout}
        title="Sign out"
        style={{
          width: '40px', height: '40px', borderRadius: '10px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '18px', background: 'transparent',
          opacity: 0.35, cursor: 'pointer',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
        onMouseLeave={e => e.currentTarget.style.opacity = '0.35'}
      >
        ↩
      </button>
    </aside>
  )
}
