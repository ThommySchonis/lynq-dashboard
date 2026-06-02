'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { rpc } from '@/lib/rpc'
import { aiLessonKeys } from './use-ai-lessons-data'
import type { AiLessonRow } from './use-ai-lessons-data'

interface AddLessonInput {
  lesson_text:         string
  applies_to_scenario: string | null
}

export function useAddAiLesson(storeId: string) {
  const queryClient = useQueryClient()

  return useMutation<AiLessonRow, Error, AddLessonInput>({
    mutationFn: async (body) => {
      const data = await rpc<{ lesson: AiLessonRow }>('api_add_ai_lesson', {
        p_store_id: storeId,
        p_lesson_text: body.lesson_text,
        p_applies_to_scenario: body.applies_to_scenario ?? null,
      })
      return data.lesson
    },
    onSuccess: () => {
      toast.success('Lesson added')
      void queryClient.invalidateQueries({ queryKey: aiLessonKeys.byStore(storeId) })
    },
    onError: (err) => toast.error(err.message),
  })
}

export function useDisableAiLesson(storeId: string) {
  const queryClient = useQueryClient()

  return useMutation<AiLessonRow, Error, string>({
    mutationFn: async (lessonId) => {
      const data = await rpc<{ lesson: AiLessonRow }>('api_update_ai_lesson', {
        p_lesson_id: lessonId,
        p_enabled: false,
      })
      return data.lesson
    },
    onSuccess: () => {
      toast.success('Lesson disabled')
      void queryClient.invalidateQueries({ queryKey: aiLessonKeys.byStore(storeId) })
    },
    onError: (err) => toast.error(err.message),
  })
}
