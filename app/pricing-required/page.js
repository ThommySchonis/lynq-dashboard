'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

// Minimal stub voor /pricing-required (ONBOARDING_SPEC v1.1 §10.2).
// De definitieve premium UX wordt opgebouwd in een latere sprint
// samen met /settings/billing en de Day 7 modal. Voor nu: 4 plan
// cards + CTAs naar /settings/billing.
//
// Geen Sidebar — blocked users mogen alleen hier, /settings/billing
// of /logout. Sidebar weghalen voorkomt dat ze rondspringen naar
// pages die alsnog 402'en (server-side) of redirecten (client-side).

const PLANS = [
  { name: 'Starter', price: '$39',  tickets: '250 tickets / month'   },
  { name: 'Growth',  price: '$79',  tickets: '1,000 tickets / month' },
  { name: 'Pro',     price: '$129', tickets: '2,000 tickets / month', highlight: true },
  { name: 'Scale',   price: '$179', tickets: '3,000 tickets / month' },
]

export default function PricingRequiredPage() {
  const [firstName, setFirstName] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return }
      const meta = session.user.user_metadata || {}
      const raw  = (meta.name || meta.full_name || session.user.email?.split('@')[0] || '').split(/\s+/)[0]
      setFirstName(raw || '')
    })
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div
      style={{
        minHeight:       '100vh',
        background:      'linear-gradient(180deg, #F9F8FF 0%, #F1EEF5 100%)',
        display:         'flex',
        alignItems:      'flex-start',
        justifyContent:  'center',
        padding:         '64px 24px',
        fontFamily:      "'Switzer', -apple-system, BlinkMacSystemFont, sans-serif",
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      <div style={{ width: '100%', maxWidth: 960 }}>
        <header style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1
            style={{
              fontSize:   30,
              fontWeight: 700,
              color:      '#1C0F36',
              letterSpacing: '-0.02em',
              marginBottom: 10,
            }}
          >
            Welcome back{firstName ? `, ${firstName}` : ''}
          </h1>
          <p style={{ fontSize: 15, color: '#6B5E7B', lineHeight: 1.5, maxWidth: 540, margin: '0 auto' }}>
            Pick a plan to access your account again. Your data is saved
            for 60 days in case you change your mind.
          </p>
        </header>

        <div
          style={{
            display:        'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap:            16,
            marginBottom:   24,
          }}
        >
          {PLANS.map(plan => (
            <PlanCard key={plan.name} plan={plan} />
          ))}
        </div>

        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: '#6B5E7B' }}>— or —</span>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link
            href="/settings/billing"
            style={{
              fontSize:       13,
              color:          '#A175FC',
              textDecoration: 'underline',
              fontWeight:     500,
            }}
          >
            Need more? Contact us for Enterprise
          </Link>
        </div>

        <p
          style={{
            textAlign:  'center',
            fontSize:   12,
            color:      '#9B91A8',
            marginBottom: 16,
          }}
        >
          Your data is safe with us. We&apos;ll keep everything for 60 days
          in case you change your mind.
        </p>

        <div style={{ textAlign: 'center' }}>
          <button
            type="button"
            onClick={logout}
            style={{
              background: 'transparent',
              border:     'none',
              color:      '#9B91A8',
              fontSize:   12,
              cursor:     'pointer',
              fontFamily: 'inherit',
              textDecoration: 'underline',
            }}
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  )
}

function PlanCard({ plan }) {
  return (
    <div
      style={{
        position:     'relative',
        padding:      '24px 20px',
        background:   '#FFFFFF',
        border:       `1px solid ${plan.highlight ? '#A175FC' : '#E5E0EB'}`,
        borderRadius: 12,
        boxShadow:    plan.highlight ? '0 4px 20px rgba(161,117,252,0.18)' : '0 1px 2px rgba(28,15,54,0.04)',
        textAlign:    'center',
      }}
    >
      {plan.highlight && (
        <div
          style={{
            position:    'absolute',
            top:         -10,
            left:        '50%',
            transform:   'translateX(-50%)',
            background:  '#A175FC',
            color:       '#FFFFFF',
            fontSize:    10,
            fontWeight:  700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding:     '3px 10px',
            borderRadius: 100,
          }}
        >
          Most popular
        </div>
      )}
      <div style={{ fontSize: 14, fontWeight: 600, color: '#1C0F36', marginBottom: 6 }}>
        {plan.name}
      </div>
      <div
        style={{
          fontSize:   28,
          fontWeight: 700,
          color:      '#1C0F36',
          letterSpacing: '-0.02em',
          marginBottom: 2,
        }}
      >
        {plan.price}
        <span style={{ fontSize: 13, fontWeight: 500, color: '#9B91A8' }}>/mo</span>
      </div>
      <div style={{ fontSize: 12, color: '#6B5E7B', marginBottom: 18 }}>
        {plan.tickets}
      </div>
      <Link
        href="/settings/billing"
        style={{
          display:        'block',
          padding:        '10px 16px',
          background:     plan.highlight ? '#A175FC' : '#FFFFFF',
          color:          plan.highlight ? '#FFFFFF' : '#1C0F36',
          border:         `1px solid ${plan.highlight ? '#A175FC' : '#E5E0EB'}`,
          borderRadius:   8,
          fontSize:       13,
          fontWeight:     600,
          textDecoration: 'none',
        }}
      >
        Continue with {plan.name}
      </Link>
    </div>
  )
}
