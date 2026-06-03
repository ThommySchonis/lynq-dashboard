'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsKeys } from './use-settings-data'
import { useToken } from './utils'
import { parseJson } from '@/lib/utils/typed-json'
import { rpc } from '@/lib/rpc'
import { apiUrl } from '@/lib/api-client'
import { toast } from 'sonner'

import type { OwnershipTransfer } from '@/types/database'

export type { OwnershipTransfer }

export const transferKeys = {
  pending: () => ['ownership-transfer', 'pending'] as const,
}

export function usePendingTransfer() {
  const token = useToken()
  return useQuery({
    queryKey: transferKeys.pending(),
    queryFn: async () => {
      const data = await rpc<{ transfer: OwnershipTransfer | null }>('api_get_pending_transfer')
      return data.transfer
    },
    enabled: !!token,
  })
}

export function useInitiateTransfer() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ toUserId, newRoleForOldOwner }: { toUserId: string; newRoleForOldOwner: string }) => {
      const res = await fetch(apiUrl('workspaces/current/transfer-ownership'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ toUserId, newRoleForOldOwner }),
      })
      const data = await parseJson<{ transfer?: OwnershipTransfer; error?: string }>(res)
      if (!res.ok) throw new Error(data.error || 'Failed to initiate transfer')
      return data as { transfer: OwnershipTransfer }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: transferKeys.pending() })
      toast.success('Transfer request sent')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useCancelTransfer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      return rpc('api_cancel_transfer')
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: transferKeys.pending() })
      toast.success('Transfer cancelled')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useAcceptTransfer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      return rpc('api_accept_transfer')
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: transferKeys.pending() })
      void qc.invalidateQueries({ queryKey: settingsKeys.workspace() })
      void qc.invalidateQueries({ queryKey: settingsKeys.members() })
      toast.success('Ownership transferred successfully')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeclineTransfer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      return rpc('api_decline_transfer')
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: transferKeys.pending() })
      toast.success('Transfer declined')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
