'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { rpc } from '@/lib/rpc'

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
      const data = await rpc<{ lessons: AiLessonRow[] }>('api_list_ai_lessons', { p_store_id: storeId })
      return data.lessons ?? []
    },
    enabled: !!token && !!storeId,
  })
}
