'use client'

import { useClientOverview } from '@/hooks/admin'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ClientRow } from './client-row'

export function ClientsList() {
  // ClientRow renders the rich ClientOverviewItem shape (planName,
  // billingStatus, hasShopify/Gmail/Outlook, suspendedAt, lastLoginAt).
  // useClients() returns the basic Client row which is missing those
  // fields; load via useClientOverview() so the row receives the type
  // it actually needs. Shares the cache with /admin/clients (the main
  // overview page), so this incurs no extra fetch.
  const { data } = useClientOverview()
  const clients = data?.clients ?? []

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Clients — {clients.length}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {clients.length === 0 ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">
            No clients yet.
          </div>
        ) : (
          clients.map((client) => (
            <ClientRow key={client.id} client={client} />
          ))
        )}
      </CardContent>
    </Card>
  )
}
