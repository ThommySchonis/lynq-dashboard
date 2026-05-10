'use client'

import Link from 'next/link'
import Sidebar from './Sidebar'

interface EmptyStateAction {
  label: string
  href?: string
  variant?: 'primary' | 'secondary' | 'link'
  onClick?: () => void
}

interface EmptyStateProps {
  icon?: string
  title: string
  description: string
  actions?: EmptyStateAction[]
}

export default function EmptyState({ icon, title, description, actions = [] }: EmptyStateProps) {
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

function ActionButton({ label, href, variant = 'primary', onClick }: EmptyStateAction) {
  const style: React.CSSProperties =
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
      : {
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
    <Link href={href || '#'} style={style}>
      {label}
    </Link>
  )
}
