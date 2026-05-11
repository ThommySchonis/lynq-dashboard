'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { academyKeys } from './use-academy-data'

interface QuizSubmission {
  moduleId: string
  score: number
  passed: boolean
  allModulesPassed: boolean
}

interface ExamSubmission {
  score: number
  passed: boolean
}

export function useSubmitQuiz() {
  const qc = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id ?? '')

  return useMutation({
    mutationFn: async ({ moduleId, score, passed, allModulesPassed }: QuizSubmission) => {
      const { error } = await supabase.from('exam_submissions').upsert(
        {
          user_id: userId,
          module_id: moduleId,
          score,
          passed,
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,module_id' },
      )
      if (error) throw error

      if (passed && allModulesPassed) {
        const { error: certError } = await supabase.from('certificates').upsert(
          {
            user_id: userId,
            issued_at: new Date().toISOString(),
            exam_score: score,
            modules_completed: 6,
          },
          { onConflict: 'user_id' },
        )
        if (certError) throw certError
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: academyKeys.passedExams() })
    },
  })
}

export function useSubmitExam() {
  const qc = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id ?? '')

  return useMutation({
    mutationFn: async ({ score, passed }: ExamSubmission) => {
      const { error } = await supabase.from('exam_submissions').upsert(
        {
          user_id: userId,
          module_id: 'final',
          score,
          passed,
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,module_id' },
      )
      if (error) throw error

      if (passed) {
        const { error: certError } = await supabase.from('certificates').upsert(
          {
            user_id: userId,
            issued_at: new Date().toISOString(),
            exam_score: score,
            modules_completed: 6,
          },
          { onConflict: 'user_id' },
        )
        if (certError) throw certError
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: academyKeys.passedExams() })
      qc.invalidateQueries({ queryKey: academyKeys.certificate() })
    },
  })
}
