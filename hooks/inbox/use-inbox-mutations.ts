'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authFetch } from '@/lib/inbox-utils'
import { useAuthStore } from '@/stores/auth'
import { parseJson } from '@/lib/utils/typed-json'
import { inboxKeys } from './use-inbox-data'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

interface ComposeEmailResponse {
  success?: boolean
  conversationId?: string
  id?: string
  error?: string
}

interface ReplyResponse {
  success?: boolean
  messageId?: string
  id?: string
  error?: string
}

interface StatusResponse {
  success?: boolean
  error?: string
}

interface AIReplyResponse {
  reply?: string
}

interface TranslateResponse {
  translated?: string
  detected?: { code: string; name: string }
}

interface AnalyzeResponse {
  analyses?: Record<string, { urgency: string }>
}

interface MacroSuggestion {
  id: string
  name: string
  body?: string
  [key: string]: unknown
}

interface AIMacrosResponse {
  macros?: MacroSuggestion[]
}

/** Compose and send a new email */
export function useComposeEmail() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      to,
      subject,
      bodyHtml,
      bodyText,
      cc,
      bcc,
    }: {
      to: Array<{ email: string; name: string }>
      subject: string
      bodyHtml: string
      bodyText: string
      cc?: Array<{ email: string; name: string }>
      bcc?: Array<{ email: string; name: string }>
    }) => {
      const res = await authFetch(
        '/api/inbox/compose',
        {
          method: 'POST',
          body: JSON.stringify({ to, subject, bodyHtml, bodyText, cc, bcc }),
        },
        token,
      )
      const data = await parseJson<ComposeEmailResponse>(res)
      if (!data.success && !data.conversationId) {
        throw new Error(data.error || 'Failed to send')
      }
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: inboxKeys.all })
    },
  })
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
      return parseJson<ReplyResponse>(res)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: inboxKeys.all })
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
      metadata,
    }: {
      threadId: string
      status: string
      metadata?: Record<string, string>
    }) => {
      const body: { status: string; metadata?: Record<string, string> } = { status }
      if (metadata) body.metadata = metadata
      const res = await authFetch(
        `/api/inbox/conversations/${threadId}`,
        { method: 'PATCH', body: JSON.stringify(body) },
        token,
      )
      return parseJson<StatusResponse>(res)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: inboxKeys.all })
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
      return parseJson<StatusResponse>(res)
    },
    onSuccess: (_, { threadId }) => {
      void qc.invalidateQueries({ queryKey: inboxKeys.conversation(threadId) })
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
      void qc.invalidateQueries({ queryKey: inboxKeys.all })
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
      messages: Array<Record<string, unknown>>
    }) => {
      const res = await authFetch(
        '/api/ai/reply',
        { method: 'POST', body: JSON.stringify({ messages, threadId }) },
        token,
      )
      const data = await parseJson<AIReplyResponse>(res)
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
      return parseJson<TranslateResponse>(res)
    },
  })
}

/** AI analyze threads for urgency */
export function useAnalyzeThreads() {
  const token = useToken()
  return useMutation({
    mutationFn: async (threads: Array<{ id: string; subject: string; snippet: string }>) => {
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
      const data = await parseJson<AnalyzeResponse>(res)
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
      return parseJson<TranslateResponse>(res)
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
      const data = await parseJson<AIMacrosResponse>(res)
      return data.macros || []
    },
  })
}
