'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { rpc } from '@/lib/rpc'
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
      const data = await rpc<{ stores: StorePublic[] }>('api_list_stores')
      return data.stores ?? []
    },
    enabled: !!token,
  })
}

export function useStoreEmailAccounts(storeId: string) {
  const token = useToken()
  return useQuery<StoreEmailAccount[]>({
    queryKey: storeKeys.emailAccounts(storeId),
    queryFn: async () => {
      const data = await rpc<{ configs: StoreEmailAccount[] }>('api_list_store_email_configs', {
        p_store_id: storeId,
      })
      return data.configs ?? []
    },
    enabled: !!token && !!storeId,
  })
}
