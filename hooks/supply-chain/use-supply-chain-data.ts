'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { useStoreStore } from '@/stores/store'
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
  shipments: (storeId?: string | null) => [...supplyChainKeys.all, 'shipments', storeId ?? null] as const,
}

export function useShipments() {
  const token = useToken()
  const activeStoreId = useStoreStore((s) => s.activeStoreId)
  return useQuery<Order[]>({
    queryKey: supplyChainKeys.shipments(activeStoreId),
    queryFn: async () => {
      const res = await fetch(apiUrl(`parcel-panel/tracking?store_id=${activeStoreId ?? ''}`), {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 404) return []
      if (!res.ok) throw new Error('Could not load shipments')
      const data = await parseJson<ShipmentsResponse>(res)
      return data.orders ?? []
    },
    enabled: !!token && !!activeStoreId,
  })
}
