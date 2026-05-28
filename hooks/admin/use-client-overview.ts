'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { parseJson } from '@/lib/utils/typed-json'
import { adminKeys } from './use-admin-data'
import type { ClientOverviewResponse } from '@/types/admin-client-overview'

export function useClientOverview() {
  const token = useAuthStore((s) => s.session?.access_token ?? '')

  return useQuery<ClientOverviewResponse>({
    queryKey: adminKeys.clientOverview(),
    queryFn: async () => {
      const res = await fetch('/api/admin/clients/overview', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await parseJson<{ error?: string }>(res)
        throw new Error(d.error || 'Failed to fetch client overview')
      }
      return parseJson<ClientOverviewResponse>(res)
    },
    staleTime: 5 * 60_000,
    enabled: !!token,
  })
}
