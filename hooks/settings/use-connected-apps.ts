'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToken } from './utils'
import { apiUrl } from '@/lib/api-client'
import { parseJson } from '@/lib/utils/typed-json'
import { toast } from 'sonner'

export interface ConnectedApp { clientId: string; clientName: string; connectedAt: string; lastUsedAt: string | null }

const connectedAppsKey = ['settings', 'connected-apps'] as const

export function useConnectedApps() {
  const token = useToken()
  return useQuery({
    queryKey: connectedAppsKey,
    enabled: !!token,
    queryFn: async (): Promise<ConnectedApp[]> => {
      const res = await fetch(apiUrl('oauth/connections'), { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Failed to load connected apps')
      const data = await parseJson<{ connections: ConnectedApp[] }>(res)
      return data.connections
    },
  })
}

export function useRevokeConnectedApp() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (clientId: string) => {
      const res = await fetch(apiUrl(`oauth/connections/${clientId}`), { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) {
        const d = await parseJson<{ error?: string }>(res).catch((): { error?: string } => ({}))
        throw new Error(d.error || 'Failed to disconnect')
      }
      return parseJson<unknown>(res)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: connectedAppsKey }); toast.success('Disconnected') },
    onError: (err: Error) => { toast.error(err.message) },
  })
}
