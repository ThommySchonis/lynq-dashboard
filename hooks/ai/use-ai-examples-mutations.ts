'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { rpc } from '@/lib/rpc'
import { aiExampleKeys } from './use-ai-examples-data'
import type { AiExampleRow } from './use-ai-examples-data'

export function useAddAiExample(storeId: string) {
  const queryClient = useQueryClient()

  return useMutation<AiExampleRow, Error, { example_text: string }>({
    mutationFn: async ({ example_text }) => {
      const data = await rpc<{ example: AiExampleRow }>('api_create_ai_example', {
        p_store_id:     storeId,
        p_example_text: example_text,
      })
      return data.example
    },
    onSuccess: () => {
      toast.success('Example added')
      void queryClient.invalidateQueries({ queryKey: aiExampleKeys.byStore(storeId) })
    },
    onError: (err) => toast.error(err.message),
  })
}

export function useDeleteAiExample(storeId: string) {
  const queryClient = useQueryClient()

  return useMutation<{ success: true }, Error, string>({
    mutationFn: async (id) => {
      const data = await rpc<{ success: true }>('api_delete_ai_example', {
        p_example_id: id,
      })
      return data
    },
    onSuccess: () => {
      toast.success('Example deleted')
      void queryClient.invalidateQueries({ queryKey: aiExampleKeys.byStore(storeId) })
    },
    onError: (err) => toast.error(err.message),
  })
}
