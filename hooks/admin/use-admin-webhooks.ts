'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { parseJson } from '@/lib/utils/typed-json'
import { adminKeys } from './use-admin-data'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

interface WebhookEvent {
  id: string
  event_id: string
  source: string
  event_type: string
  status: string
  error_message: string | null
  attempt_count: number
  next_retry_at: string | null
  workspace_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  completed_at: string | null
}

interface WebhookListResponse {
  events: WebhookEvent[]
  total: number
  page: number
  limit: number
}

export const webhookKeys = {
  all: [...adminKeys.all, 'webhooks'] as const,
  list: (filters: Record<string, string>) =>
    [...webhookKeys.all, 'list', filters] as const,
}

export function useWebhookEvents(filters: {
  status?: string
  source?: string
  page?: number
}) {
  const token = useToken()
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.source) params.set('source', filters.source)
  if (filters.page) params.set('page', String(filters.page))

  return useQuery<WebhookListResponse>({
    queryKey: webhookKeys.list(Object.fromEntries(params)),
    queryFn: async () => {
      const res = await fetch(`/api/admin/webhooks?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch webhook events')
      return parseJson<WebhookListResponse>(res)
    },
    enabled: !!token,
    staleTime: 30_000,
  })
}

export function useRetryWebhooks() {
  const token = useToken()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch('/api/admin/webhooks/retry', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids }),
      })
      if (!res.ok) throw new Error('Failed to retry webhooks')
      return parseJson<{ ok: boolean; updated: number }>(res)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: webhookKeys.all })
    },
  })
}

export function useDismissWebhooks() {
  const token = useToken()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch('/api/admin/webhooks/dismiss', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids }),
      })
      if (!res.ok) throw new Error('Failed to dismiss webhooks')
      return parseJson<{ ok: boolean; updated: number }>(res)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: webhookKeys.all })
    },
  })
}
