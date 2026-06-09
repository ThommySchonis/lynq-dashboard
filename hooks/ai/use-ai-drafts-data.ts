'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { rpc } from '@/lib/rpc'
import type { AiDraft } from '@/types/ai-drafts'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const aiDraftKeys = {
  all: ['ai-drafts'] as const,
  pending: (conversationId: string) => [...aiDraftKeys.all, 'pending', conversationId] as const,
  autoSent: (conversationId: string) => [...aiDraftKeys.all, 'auto-sent', conversationId] as const,
}

export function usePendingDraft(conversationId: string | null) {
  const token = useToken()
  return useQuery<AiDraft | null>({
    queryKey: aiDraftKeys.pending(conversationId ?? ''),
    queryFn: async () => {
      const data = await rpc<AiDraft | null>('api_get_pending_draft', {
        p_conversation_id: conversationId,
      })
      return data ?? null
    },
    enabled: !!token && !!conversationId,
  })
}

export function useAutoSentDraftTimes(conversationId: string | null) {
  const token = useToken()
  return useQuery<string[]>({
    queryKey: aiDraftKeys.autoSent(conversationId ?? ''),
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_drafts')
        .select('resolved_at')
        .eq('conversation_id', conversationId!)
        .eq('status', 'auto_sent')
      return (data ?? []).map((d) => d.resolved_at as string).filter(Boolean)
    },
    enabled: !!token && !!conversationId,
  })
}
