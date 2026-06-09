'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { rpc } from '@/lib/rpc'
import { aiDraftKeys } from './use-ai-drafts-data'
import { inboxKeys } from '@/hooks/inbox/use-inbox-data'
import type { UpdateDraftStatusInput } from '@/types/ai-drafts'

export function useUpdateDraftStatus(conversationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateDraftStatusInput) => {
      return rpc<{ id: string; status: string }>('api_update_draft_status', {
        p_draft_id: input.draftId,
        p_status: input.status,
        p_edited_text: input.editedText ?? null,
        p_feedback_category: input.feedbackCategory ?? null,
        p_feedback_comment: input.feedbackComment ?? null,
      })
    },
    onSuccess: (_data, input) => {
      void qc.invalidateQueries({ queryKey: aiDraftKeys.pending(conversationId) })
      if (input.status === 'approved' || input.status === 'edited') {
        void qc.invalidateQueries({ queryKey: inboxKeys.all })
      }
    },
    onError: (err) => toast.error(err.message),
  })
}
