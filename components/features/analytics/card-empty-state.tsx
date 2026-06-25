'use client'

import type { LucideIcon } from 'lucide-react'

interface CardEmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  /** 'lg' uses an 18px bold heading (large cards), 'sm' a 14px semibold one (compact cards). */
  size?: 'sm' | 'lg'
}

export function CardEmptyState({ icon: Icon, title, description, size = 'sm' }: CardEmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${size === 'lg' ? 'gap-3 py-12' : 'gap-2.5 py-8'}`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-muted">
        <Icon size={20} className="text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <div className={size === 'lg' ? 'text-[18px] font-bold text-foreground' : 'text-sm font-semibold text-foreground'}>
          {title}
        </div>
        {description ? (
          <div className="mx-auto max-w-xs text-[13px] text-muted-foreground">{description}</div>
        ) : null}
      </div>
    </div>
  )
}
