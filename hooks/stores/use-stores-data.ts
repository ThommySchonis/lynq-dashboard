'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import type { StorePublic, StoreEmailConfig } from '@/types/stores'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const storeKeys = {
  all: ['stores'] as const,
  list: () => [...storeKeys.all, 'list'] as const,
  emailConfigs: (storeId: string) => [...storeKeys.all, 'email-configs', storeId] as const,
}

export function useStores() {
  const token = useToken()
  return useQuery<StorePublic[]>({
    queryKey: storeKeys.list(),
    queryFn: async () => {
      const res = await fetch('/api/stores', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load stores')
      const data = await res.json()
      return (data.stores ?? []) as StorePublic[]
    },
    enabled: !!token,
  })
}

export function useStoreEmailConfigs(storeId: string) {
  const token = useToken()
  return useQuery<StoreEmailConfig[]>({
    queryKey: storeKeys.emailConfigs(storeId),
    queryFn: async () => {
      const res = await fetch(`/api/stores/${storeId}/email-configs`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load email configs')
      const data = await res.json()
      return (data.configs ?? []) as StoreEmailConfig[]
    },
    enabled: !!token && !!storeId,
  })
}
