'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { supplyChainKeys } from './use-supply-chain-data'
import { parseJson } from '@/lib/utils/typed-json'

interface ErrorResponse {
  error?: string
}

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export function useConnectParcelPanel() {
  const token = useToken()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (apiKey: string) => {
      const res = await fetch('/api/parcel-panel/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ apiKey }),
      })
      if (!res.ok) {
        const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(d.error || 'Failed to connect Parcel Panel')
      }
      return parseJson<unknown>(res)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: supplyChainKeys.shipments() })
    },
  })
}
