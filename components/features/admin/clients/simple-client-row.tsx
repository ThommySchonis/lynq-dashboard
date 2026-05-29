'use client'

import type { Client } from '@/types/admin'

interface SimpleClientRowProps {
  client: Client
}

const STATUS_BADGE: Record<string, string> = {
  active: 'border-emerald-500/15 bg-emerald-500/8 text-emerald-600',
  inactive: 'border-border bg-muted text-muted-foreground',
}

export function SimpleClientRow({ client }: SimpleClientRowProps) {
  const initial = (client.company_name || '?')[0].toUpperCase()

  return (
    <div className="flex items-center gap-2.5 border-b border-border px-4 py-2.5 last:border-b-0">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-foreground">
          {client.company_name}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          {client.email}
        </div>
      </div>
      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${
        STATUS_BADGE[client.status] ?? STATUS_BADGE.inactive
      }`}>
        {client.status}
      </span>
    </div>
  )
}
