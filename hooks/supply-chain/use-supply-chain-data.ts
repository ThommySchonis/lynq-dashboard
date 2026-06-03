'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { parseJson } from '@/lib/utils/typed-json'
import { apiUrl } from '@/lib/api-client'
import type { Order } from '@/types/supply-chain'

interface ShipmentsResponse {
  orders?: Order[]
}

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const supplyChainKeys = {
  all: ['supply-chain'] as const,
  shipments: () => [...supplyChainKeys.all, 'shipments'] as const,
}

export function useShipments() {
  const token = useToken()
  return useQuery<Order[]>({
    queryKey: supplyChainKeys.shipments(),
    queryFn: async () => {
      const res = await fetch(apiUrl('parcel-panel/tracking'), {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 404) return []
      if (!res.ok) throw new Error('Could not load shipments')
      const data = await parseJson<ShipmentsResponse>(res)
      return data.orders ?? []
    },
    enabled: !!token,
  })
}
