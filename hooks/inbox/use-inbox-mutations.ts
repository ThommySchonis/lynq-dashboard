'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authFetch } from '@/lib/inbox-utils'
import { useAuthStore } from '@/stores/auth'
import { inboxKeys } from './use-inbox-data'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

/** Send reply to a conversation */
export function useSendReply() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      threadId,
      bodyHtml,
      bodyText,
    }: {
      threadId: string
      bodyHtml: string
      bodyText: string
    }) => {
      const res = await authFetch(
        `/api/inbox/conversations/${threadId}/reply`,
        { method: 'POST', body: JSON.stringify({ bodyHtml, bodyText }) },
        token,
      )
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inboxKeys.all })
    },
  })
}

/** Update conversation status */
export function useUpdateStatus() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      threadId,
      status,
    }: {
      threadId: string
      status: string
    }) => {
      const res = await authFetch(
        `/api/inbox/conversations/${threadId}`,
        { method: 'PATCH', body: JSON.stringify({ status }) },
        token,
      )
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inboxKeys.all })
    },
  })
}

/** Add internal note */
export function useAddNote() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      threadId,
      body,
    }: {
      threadId: string
      body: string
    }) => {
      const res = await authFetch(
        `/api/inbox/conversations/${threadId}/notes`,
        { method: 'POST', body: JSON.stringify({ body }) },
        token,
      )
      return res.json()
    },
    onSuccess: (_, { threadId }) => {
      qc.invalidateQueries({ queryKey: inboxKeys.conversation(threadId) })
    },
  })
}

/** Trigger email sync */
export function useSyncInbox() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await authFetch('/api/inbox/sync', { method: 'POST' }, token)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inboxKeys.all })
    },
  })
}

/** AI generate reply */
export function useAIReply() {
  const token = useToken()
  return useMutation({
    mutationFn: async ({
      threadId,
      messages,
    }: {
      threadId: string
      messages: any[]
    }) => {
      const res = await authFetch(
        '/api/ai/reply',
        { method: 'POST', body: JSON.stringify({ messages, threadId }) },
        token,
      )
      const data = await res.json()
      return data.reply || null
    },
  })
}

/** Translate outgoing message to target language */
export function useTranslateMessage() {
  const token = useToken()
  return useMutation({
    mutationFn: async ({
      text,
      targetLang,
    }: {
      text: string
      targetLang?: string
    }) => {
      const res = await authFetch(
        '/api/ai/translate',
        {
          method: 'POST',
          body: JSON.stringify(targetLang ? { text, targetLang } : { text }),
        },
        token,
      )
      return res.json()
    },
  })
}

/** AI analyze threads for urgency */
export function useAnalyzeThreads() {
  const token = useToken()
  return useMutation({
    mutationFn: async (threads: any[]) => {
      const res = await authFetch(
        '/api/ai/analyze',
        {
          method: 'POST',
          body: JSON.stringify({
            threads: threads
              .slice(0, 25)
              .map((t) => ({ id: t.id, subject: t.subject, snippet: t.snippet })),
          }),
        },
        token,
      )
      const data = await res.json()
      return data.analyses || {}
    },
  })
}

/** Detect language */
export function useDetectLanguage() {
  const token = useToken()
  return useMutation({
    mutationFn: async (text: string) => {
      const res = await authFetch(
        '/api/ai/translate',
        { method: 'POST', body: JSON.stringify({ text, detectOnly: true }) },
        token,
      )
      return res.json()
    },
  })
}

/** AI macro suggestions */
export function useAIMacros() {
  const token = useToken()
  return useMutation({
    mutationFn: async ({
      subject,
      snippet,
    }: {
      subject: string
      snippet: string
    }) => {
      const res = await authFetch(
        '/api/ai/macros',
        { method: 'POST', body: JSON.stringify({ subject, snippet }) },
        token,
      )
      const data = await res.json()
      return data.macros || []
    },
  })
}
