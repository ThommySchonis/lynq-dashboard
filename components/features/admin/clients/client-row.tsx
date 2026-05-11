import type { Client } from '@/types/admin'

interface ClientRowProps {
  client: Client
}

export function ClientRow({ client }: ClientRowProps) {
  const initial = (client.company_name || '?')[0].toUpperCase()
  const isActive = client.status === 'active'

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#F0F0F0] text-xs font-semibold text-[#555]">
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-foreground">
          {client.company_name}
        </div>
        <div className="text-xs text-muted-foreground">{client.email}</div>
      </div>
      <span
        className={
          isActive
            ? 'rounded-full border border-emerald-500/15 bg-emerald-500/8 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600'
            : 'rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground'
        }
      >
        {client.status}
      </span>
    </div>
  )
}
