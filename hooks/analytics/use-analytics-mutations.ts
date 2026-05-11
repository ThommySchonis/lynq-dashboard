'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { analyticsKeys } from './use-analytics-data'

interface UpdateActionStatusParams {
  id: string
  status: string
  pickedUpBy?: string
  resultNote?: string
}

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export function useUpdateActionStatus() {
  const token = useToken()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status, pickedUpBy, resultNote }: UpdateActionStatusParams) => {
      const res = await fetch('/api/analytics/actions', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, status, pickedUpBy, resultNote }),
      })
      if (!res.ok) throw new Error('Failed to update action status')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: analyticsKeys.actionStatuses() })
    },
  })
}
