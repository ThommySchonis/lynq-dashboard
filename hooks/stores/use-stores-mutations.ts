'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { storeKeys } from './use-stores-data'
import { toast } from 'sonner'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export function useUpdateStore() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ storeId, name }: { storeId: string; name: string }) => {
      const res = await fetch(`/api/stores/${storeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Failed to update store')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: storeKeys.list() })
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
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Failed to disconnect store')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: storeKeys.list() })
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
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Failed to delete store')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: storeKeys.list() })
      toast.success('Store deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteStoreEmailConfig() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ storeId, configId }: { storeId: string; configId: string }) => {
      const res = await fetch(`/api/stores/${storeId}/email-configs/${configId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Failed to remove email config')
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: storeKeys.emailConfigs(vars.storeId) })
      toast.success('Email account removed')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
