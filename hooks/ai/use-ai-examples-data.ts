'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { rpc } from '@/lib/rpc'

export const aiExampleKeys = {
  all:     ['ai-examples'] as const,
  byStore: (storeId: string) => [...aiExampleKeys.all, storeId] as const,
}

export interface AiExampleRow {
  id:           string
  workspace_id: string
  store_id:     string
  example_text: string
  created_at:   string
}

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export function useAiExamples(storeId: string) {
  const token = useToken()
  return useQuery<AiExampleRow[]>({
    queryKey: aiExampleKeys.byStore(storeId),
    queryFn: async () => {
      const data = await rpc<{ examples: AiExampleRow[] }>('api_list_ai_examples', {
        p_store_id: storeId,
      })
      return data.examples ?? []
    },
    enabled: !!token && !!storeId,
  })
}
