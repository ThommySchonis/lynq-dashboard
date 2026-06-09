'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { rpc } from '@/lib/rpc'
import type { StorePublic, StoreEmailAccount } from '@/types/stores'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export interface StoreAiSettings {
  ai_auto_generate: boolean
  ai_auto_send_enabled: boolean
}

export const storeKeys = {
  all: ['stores'] as const,
  list: () => [...storeKeys.all, 'list'] as const,
  emailAccounts: (storeId: string) => [...storeKeys.all, 'email-accounts', storeId] as const,
  aiSettings: (storeId: string) => [...storeKeys.all, 'ai-settings', storeId] as const,
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

export function useStoreAiSettings(storeId: string) {
  const token = useToken()
  return useQuery<StoreAiSettings>({
    queryKey: storeKeys.aiSettings(storeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('ai_auto_generate, ai_auto_send_enabled')
        .eq('id', storeId)
        .single()
      if (error) throw new Error(error.message)
      return data as StoreAiSettings
    },
    enabled: !!token && !!storeId,
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
