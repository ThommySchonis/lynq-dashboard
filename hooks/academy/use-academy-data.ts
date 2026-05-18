'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import type { Certificate } from '@/types/academy'

export const academyKeys = {
  all: ['academy'] as const,
  passedExams: () => [...academyKeys.all, 'passedExams'] as const,
  certificate: () => [...academyKeys.all, 'certificate'] as const,
}

function useUserId() {
  return useAuthStore((s) => s.user?.id ?? '')
}

export function usePassedExams() {
  const userId = useUserId()
  return useQuery<string[]>({
    queryKey: academyKeys.passedExams(),
    queryFn: async () => {
      const { data } = await supabase
        .from('exam_submissions')
        .select('module_id, passed')
        .eq('user_id', userId)
        .eq('passed', true)
      return (data ?? []).map((r) => r.module_id as string)
    },
    enabled: !!userId,
  })
}

export function useCertificate() {
  const userId = useUserId()
  return useQuery<Certificate | null>({
    queryKey: academyKeys.certificate(),
    queryFn: async () => {
      const result = await supabase
        .from('certificates')
        .select('*')
        .eq('user_id', userId)
        .single()
      return (result.data as unknown as Certificate) ?? null
    },
    enabled: !!userId,
  })
}
