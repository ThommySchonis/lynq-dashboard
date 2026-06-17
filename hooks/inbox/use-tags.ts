'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authFetch } from '@/lib/inbox-utils'
import { useAuthStore } from '@/stores/auth'
import { parseJson } from '@/lib/utils/typed-json'
import { apiUrl } from '@/lib/api-client'
import type { ConversationTag } from '@/types/inbox'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

interface TagsResponse {
  tags?: ConversationTag[]
}
interface TagResponse {
  tag?: ConversationTag
  error?: string
}

export const tagKeys = {
  all: ['tags'] as const,
}

/** List all workspace tags */
export function useTags() {
  const token = useToken()
  return useQuery<ConversationTag[]>({
    queryKey: tagKeys.all,
    queryFn: async () => {
      const res = await authFetch(apiUrl('tags'), {}, token)
      const data = await parseJson<TagsResponse>(res)
      return data.tags ?? []
    },
    enabled: !!token,
    staleTime: 60_000,
  })
}

/** Create a new workspace tag */
export function useCreateTag() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color?: string }) => {
      const res = await authFetch(
        apiUrl('tags'),
        { method: 'POST', body: JSON.stringify({ name, color }) },
        token,
      )
      const data = await parseJson<TagResponse>(res)
      if (!data.tag) throw new Error(data.error || 'Failed to create tag')
      return data.tag
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tagKeys.all })
    },
  })
}

