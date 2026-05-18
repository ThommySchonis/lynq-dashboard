'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'

export interface FeedbackUser {
  name?: string
  email?: string
}

export interface FeedbackWorkspace {
  name?: string
}

export interface FeedbackSubmission {
  id: string
  type: 'bug' | 'feedback' | 'other'
  message: string
  page_url?: string
  user_agent?: string
  created_at: string
  user?: FeedbackUser
  workspace?: FeedbackWorkspace
}

export interface FeedbackListResponse {
  submissions: FeedbackSubmission[]
}

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const lynqAdminKeys = {
  all: ['lynq-admin'] as const,
  feedback: () => [...lynqAdminKeys.all, 'feedback'] as const,
}

export function useFeedbackList() {
  const token = useToken()
  return useQuery<FeedbackListResponse>({
    queryKey: lynqAdminKeys.feedback(),
    queryFn: async () => {
      const res = await fetch('/api/lynq-admin/feedback', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (!res.ok) {
        const err = new Error('Failed to fetch feedback') as Error & { status: number }
        err.status = res.status
        throw err
      }
      return res.json() as Promise<FeedbackListResponse>
    },
    enabled: !!token,
  })
}
