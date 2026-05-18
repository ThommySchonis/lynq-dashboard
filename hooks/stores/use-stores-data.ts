'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import type { StorePublic, StoreEmailAccount } from '@/types/stores'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const storeKeys = {
  all: ['stores'] as const,
  list: () => [...storeKeys.all, 'list'] as const,
  emailAccounts: (storeId: string) => [...storeKeys.all, 'email-accounts', storeId] as const,
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

export function useStoreEmailAccounts(storeId: string) {
  const token = useToken()
  return useQuery<StoreEmailAccount[]>({
    queryKey: storeKeys.emailAccounts(storeId),
    queryFn: async () => {
      const res = await fetch(`/api/stores/${storeId}/email-configs`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load email configs')
      const data = await res.json()
      return (data.configs ?? []) as StoreEmailAccount[]
    },
    enabled: !!token && !!storeId,
  })
}
