'use client'

import { useClients } from '@/hooks/admin'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ClientRow } from './client-row'

export function ClientsList() {
  const { data: clients = [] } = useClients()

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
