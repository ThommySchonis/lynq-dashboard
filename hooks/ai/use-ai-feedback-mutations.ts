'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { rpc } from '@/lib/rpc'
import { feedbackKeys } from './use-ai-feedback-data'

export function usePromoteDraftToLesson(storeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      draftId: string
      lessonText: string
      appliesToScenario?: string
    }) => {
      return rpc<{ lesson: Record<string, unknown> }>('api_promote_draft_to_lesson', {
        p_draft_id: input.draftId,
        p_lesson_text: input.lessonText,
        p_applies_to_scenario: input.appliesToScenario ?? null,
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: feedbackKeys.resolved(storeId) })
    },
  })
}

export function usePromoteDraftToExample(storeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { draftId: string; exampleText: string }) => {
      return rpc<{ example: Record<string, unknown> }>('api_promote_draft_to_example', {
        p_draft_id: input.draftId,
        p_example_text: input.exampleText,
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: feedbackKeys.resolved(storeId) })
    },
  })
}
