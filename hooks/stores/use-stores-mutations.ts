'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { storeKeys } from './use-stores-data'
import { rpc } from '@/lib/rpc'
import { toast } from 'sonner'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export function useUpdateStore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ storeId, name }: { storeId: string; name: string }) => {
      return rpc('api_update_store', { p_store_id: storeId, p_name: name })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: storeKeys.list() })
      toast.success('Store updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDisconnectStore() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (storeId: string) => {
      const res = await fetch(`/api/stores/${storeId}/disconnect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await (res.json() as Promise<{ error?: string }>).catch(() => ({} as { error?: string }))
        throw new Error(d.error ?? 'Failed to disconnect store')
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: storeKeys.list() })
      toast.success('Store disconnected')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteStore() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (storeId: string) => {
      const res = await fetch(`/api/stores/${storeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await (res.json() as Promise<{ error?: string }>).catch(() => ({} as { error?: string }))
        throw new Error(d.error ?? 'Failed to delete store')
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: storeKeys.list() })
      toast.success('Store deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteStoreEmailAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ storeId, configId }: { storeId: string; configId: string }) => {
      return rpc('api_delete_store_email_config', { p_store_id: storeId, p_config_id: configId })
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: storeKeys.emailAccounts(vars.storeId) })
      toast.success('Email account removed')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
