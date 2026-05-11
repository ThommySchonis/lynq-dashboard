'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import type { Order } from '@/types/supply-chain'

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
      const res = await fetch('/api/parcel-panel/tracking', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 404) return []
      if (!res.ok) throw new Error('Could not load shipments')
      const data = await res.json()
      return (data.orders as Order[]) ?? []
    },
    enabled: !!token,
  })
}
