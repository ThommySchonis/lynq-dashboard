'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { rpc } from '@/lib/rpc'
import type { ResolvedDraft, DraftStatus } from '@/types/ai-drafts'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const feedbackKeys = {
  all: ['ai-feedback'] as const,
  resolved: (storeId: string, status?: DraftStatus) =>
    [...feedbackKeys.all, 'resolved', storeId, status ?? 'all'] as const,
}

export function useResolvedDrafts(
  storeId: string,
  status?: DraftStatus,
  limit = 50,
  offset = 0,
) {
  const token = useToken()
  return useQuery<ResolvedDraft[]>({
    queryKey: feedbackKeys.resolved(storeId, status),
    queryFn: async () => {
      const data = await rpc<ResolvedDraft[]>('api_list_resolved_drafts', {
        p_store_id: storeId,
        p_status: status ?? null,
        p_limit: limit,
        p_offset: offset,
      })
      return data ?? []
    },
    enabled: !!token && !!storeId,
  })
}
