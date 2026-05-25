'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useToken } from '@/hooks/settings/utils'
import { parseJson } from '@/lib/utils/typed-json'

export const accountDeletionKeys = {
  status: () => ['account-deletion', 'status'] as const,
}

export function useAccountDeletionStatus() {
  const token = useToken()
  return useQuery({
    queryKey: accountDeletionKeys.status(),
    queryFn: async () => {
      const res = await fetch('/api/account/deletion-status', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch deletion status')
      return parseJson<{ scheduled: boolean; scheduledFor: string | null }>(res)
    },
  })
}

export function useScheduleAccountDeletion() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const data = await parseJson<{ error: string }>(res)
        throw new Error(data.error)
      }
      return parseJson<{ scheduledFor: string }>(res)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: accountDeletionKeys.status() })
      toast.success('Account deletion scheduled')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useCancelAccountDeletion() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/account/cancel-deletion', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await parseJson<{ error: string }>(res)
        throw new Error(data.error)
      }
      return parseJson<{ cancelled: boolean }>(res)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: accountDeletionKeys.status() })
      toast.success('Account deletion cancelled')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
