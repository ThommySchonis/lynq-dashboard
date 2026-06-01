'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const aiLessonKeys = {
  all:     ['ai-lessons'] as const,
  byStore: (storeId: string) => [...aiLessonKeys.all, storeId] as const,
}

export interface AiLessonRow {
  id:                  string
  workspace_id?:       string
  store_id?:           string
  lesson_text:         string
  source_type?:        'edit' | 'reject' | 'manual'
  source_ref?:         string | null
  applies_to_scenario: string | null
  applies_to_policy?:  string | null
  created_by?:         string | null
  created_at:          string
  enabled:             boolean
}

export function useAiLessons(storeId: string) {
  const token = useToken()
  return useQuery<AiLessonRow[]>({
    queryKey: aiLessonKeys.byStore(storeId),
    queryFn: async () => {
      const res = await fetch(`/api/ai/lessons?store_id=${encodeURIComponent(storeId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load AI lessons')
      const data = await res.json() as { lessons?: AiLessonRow[] }
      return data.lessons ?? []
    },
    enabled: !!token && !!storeId,
  })
}
