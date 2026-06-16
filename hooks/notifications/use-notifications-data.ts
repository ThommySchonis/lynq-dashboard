'use client'

import { useQuery } from '@tanstack/react-query'
import { listNotifications } from '@/lib/rpc'
import { useAuthStore } from '@/stores/auth'

export const notificationKeys = {
  all: ['notifications'] as const,
  feed: () => [...notificationKeys.all, 'feed'] as const,
}

export function useNotifications() {
  const session = useAuthStore((s) => s.session)
  const query = useQuery({
    queryKey: notificationKeys.feed(),
    queryFn: () => listNotifications(),
    enabled: !!session,
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
  })
  return {
    notifications: query.data?.items ?? [],
    unreadCount: query.data?.unread_count ?? 0,
    hasMore: query.data?.has_more ?? false,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  }
}
