'use client'

import { useClientOverview } from '@/hooks/admin'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ClientRow } from '@/components/features/admin/clients/client-row'

export function RecentClientsList() {
  // ClientRow needs the rich ClientOverviewItem shape; useClients()
  // returns the basic Client row. Same upstream switch as clients-list.tsx
  // — shares the React Query cache with the main /admin/clients overview.
  const { data } = useClientOverview()
  const clients = data?.clients ?? []

  if (clients.length === 0) return null

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Recent Clients</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-0 p-0">
        {clients.slice(0, 5).map((client) => (
          <ClientRow key={client.id} client={client} />
        ))}
      </CardContent>
    </Card>
  )
}
