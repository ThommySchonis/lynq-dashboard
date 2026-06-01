'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { toast } from 'sonner'
import { aiLessonKeys } from './use-ai-lessons-data'
import type { AiLessonRow } from './use-ai-lessons-data'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

interface AddLessonInput {
  lesson_text:         string
  applies_to_scenario: string | null
}

export function useAddAiLesson(storeId: string) {
  const token = useToken()
  const queryClient = useQueryClient()

  return useMutation<AiLessonRow, Error, AddLessonInput>({
    mutationFn: async (body) => {
      const res = await fetch('/api/ai/lessons', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...body, store_id: storeId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? 'Failed to add lesson')
      }
      const data = await res.json() as { lesson: AiLessonRow }
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
  const token = useToken()
  const queryClient = useQueryClient()

  return useMutation<AiLessonRow, Error, string>({
    mutationFn: async (lessonId) => {
      const res = await fetch(`/api/ai/lessons/${encodeURIComponent(lessonId)}`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ enabled: false }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? 'Failed to disable lesson')
      }
      const data = await res.json() as { lesson: AiLessonRow }
      return data.lesson
    },
    onSuccess: () => {
      toast.success('Lesson disabled')
      void queryClient.invalidateQueries({ queryKey: aiLessonKeys.byStore(storeId) })
    },
    onError: (err) => toast.error(err.message),
  })
}
