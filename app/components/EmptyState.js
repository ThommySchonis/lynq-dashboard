'use client'

import Link from 'next/link'
import Sidebar from './Sidebar'

// Reusable full-page empty state. Renders Sidebar + centered content
// with title, description, and 1+ action buttons. Consumed by /inbox,
// /analytics, /performance, /macros, /tags per ONBOARDING_SPEC v1.1
// section 4.
//
// Usage:
//   <EmptyState
//     icon="📬"
//     title="Your inbox is empty"
//     description="Connect your email to start receiving customer support tickets."
//     actions={[
//       { label: 'Connect Gmail',   href: '/settings/email', variant: 'primary' },
//       { label: 'Connect Outlook', href: '/settings/email', variant: 'primary' },
//     ]}
//   />
//
// Action variants: 'primary' (Iris Electric filled), 'secondary' (white
// w/ border), 'link' (text-only inline). Multiple primary buttons allowed.
export default function EmptyState({ icon, title, description, actions = [] }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F9F8FF' }}>
      <Sidebar />
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          {icon && (
            <div style={{ fontSize: 48, marginBottom: 16, lineHeight: 1 }}>{icon}</div>
          )}
          <h1
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: '#1C0F36',
              letterSpacing: '-0.01em',
              marginBottom: 8,
            }}
          >
            {title}
          </h1>
          <p
            style={{
              fontSize: 14,
              color: '#6B5E7B',
              lineHeight: 1.6,
              marginBottom: 24,
            }}
          >
            {description}
          </p>
          {actions.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: 12,
                justifyContent: 'center',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              {actions.map((a, i) => (
                <ActionButton key={i} {...a} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function ActionButton({ label, href, variant = 'primary', onClick }) {
  const style =
    variant === 'primary'
      ? {
          padding: '10px 20px',
          borderRadius: 8,
          background: '#A175FC',
          color: '#FFFFFF',
          border: 'none',
          fontSize: 13,
          fontWeight: 600,
          textDecoration: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }
      : variant === 'secondary'
      ? {
          padding: '10px 20px',
          borderRadius: 8,
          background: '#FFFFFF',
          color: '#1C0F36',
          border: '1px solid #E5E0EB',
          fontSize: 13,
          fontWeight: 600,
          textDecoration: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }
      : /* link */ {
          color: '#A175FC',
          fontSize: 13,
          fontWeight: 500,
          textDecoration: 'underline',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} style={style}>
        {label}
      </button>
    )
  }
  return (
    <Link href={href} style={style}>
      {label}
    </Link>
  )
}
