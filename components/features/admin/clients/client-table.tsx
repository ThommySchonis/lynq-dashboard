'use client'

import type { ClientOverviewItem } from '@/types/admin-client-overview'
import { ClientRow } from './client-row'

interface ClientTableProps {
  clients: ClientOverviewItem[]
}

export function ClientTable({ clients }: ClientTableProps) {
  if (clients.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        No clients match the current filters.
      </div>
    )
  }

  return (
    <div>
      {/* Column headers */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2 text-[11px] font-medium text-muted-foreground">
        <div style={{ width: '240px' }}>Client</div>
        <div style={{ width: '80px' }}>Billing</div>
        <div style={{ width: '80px' }}>S / G / O</div>
        <div style={{ width: '70px' }}>Last Login</div>
        <div className="ml-auto">Actions</div>
      </div>

      {/* Rows */}
      {clients.map((client) => (
        <ClientRow key={client.id} client={client} />
      ))}
    </div>
  )
}
