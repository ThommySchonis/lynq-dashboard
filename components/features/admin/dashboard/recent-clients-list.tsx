'use client'

import { useClients } from '@/hooks/admin'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ClientRow } from '@/components/features/admin/clients/client-row'

export function RecentClientsList() {
  const { data: clients = [] } = useClients()

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
