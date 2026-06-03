'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { supplyChainKeys } from './use-supply-chain-data'
import { parseJson } from '@/lib/utils/typed-json'
import { apiUrl } from '@/lib/api-client'

interface ErrorResponse {
  error?: string
}

interface ConnectResponse {
  success: boolean
  webhookToken: string
}

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export function useConnectParcelPanel() {
  const token = useToken()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (apiKey: string): Promise<ConnectResponse> => {
      const res = await fetch(apiUrl('parcel-panel/connect'), {
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
      return parseJson<ConnectResponse>(res)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: supplyChainKeys.shipments() })
    },
  })
}
