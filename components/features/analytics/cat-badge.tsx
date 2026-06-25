'use client'

import { BADGE_COLORS } from '@/lib/analytics-constants'

interface CatBadgeProps {
  cat: string
  small?: boolean
}

export function CatBadge({ cat, small }: CatBadgeProps) {
  const c = BADGE_COLORS[cat] || BADGE_COLORS['Other']
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full font-bold uppercase tracking-[.05em]"
      style={{
        fontSize: small ? 9.5 : 10.5,
        color: c.color,
        background: c.bg,
        border: c.border || 'none',
        padding: small ? '1px 7px' : '2px 9px',
      }}
    >
      {cat}
    </span>
  )
}
