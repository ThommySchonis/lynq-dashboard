'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { useStoreStore } from '@/stores/store'
import { rpc } from '@/lib/rpc'
import type { DraftStatus } from '@/types/ai-drafts'
import type { EmmaActivityEvent, EmmaActivityPage } from '@/types/ai-drafts'
import type { DateRange } from '@/types/analytics'

const PAGE_SIZE = 20

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const emmaActivityKeys = {
  all: ['emma-activity'] as const,
  list: (storeId: string | null, from: string, to: string, statuses: DraftStatus[]) =>
    [...emmaActivityKeys.all, storeId, from, to, [...statuses].sort()] as const,
}

export interface UseEmmaActivityArgs {
  range: DateRange
  statuses: DraftStatus[]
}

export interface UseEmmaActivityResult {
  events: EmmaActivityEvent[]
  hasMore: boolean
  total: number
  isLoading: boolean
  isFetchingMore: boolean
  error: Error | null
  fetchMore: () => void
  refetch: () => void
}

export function useEmmaActivity({ range, statuses }: UseEmmaActivityArgs): UseEmmaActivityResult {
  const token = useToken()
  const activeStoreId = useStoreStore((s) => s.activeStoreId)

  const query = useInfiniteQuery<EmmaActivityPage, Error>({
    queryKey: emmaActivityKeys.list(activeStoreId, range.from, range.to, statuses),
    enabled: !!token && !!activeStoreId,
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.has_more ? allPages.length * PAGE_SIZE : undefined,
    queryFn: async ({ pageParam }) => {
      const data = await rpc<EmmaActivityPage | null>('api_list_emma_activity', {
        p_store_id: activeStoreId,
        p_from:     range.from,
        p_to:       range.to,
        p_statuses: statuses.length > 0 ? statuses : null,
        p_limit:    PAGE_SIZE,
        p_offset:   pageParam as number,
      })
      return data ?? { items: [], has_more: false, total: 0 }
    },
  })

  const events = query.data?.pages.flatMap((p) => p.items) ?? []
  const lastPage = query.data?.pages[query.data.pages.length - 1]

  return {
    events,
    hasMore: lastPage?.has_more ?? false,
    total:   lastPage?.total ?? 0,
    isLoading: query.isPending,
    isFetchingMore: query.isFetchingNextPage,
    error: (query.error as Error | null) ?? null,
    fetchMore: () => { void query.fetchNextPage() },
    refetch:   () => { void query.refetch() },
  }
}
