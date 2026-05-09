'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authFetch } from '@/lib/inbox-utils'
import { useAuthStore } from '@/stores/auth'

// ─── Keys ────────────────────────────────────────────────────
export const inboxKeys = {
  all: ['inbox'] as const,
  conversations: (folder: string, search?: string) =>
    [...inboxKeys.all, 'conversations', folder, search] as const,
  conversation: (id: string) => [...inboxKeys.all, 'conversation', id] as const,
  counts: () => [...inboxKeys.all, 'counts'] as const,
  accounts: () => [...inboxKeys.all, 'accounts'] as const,
  customer: (query: string) => ['customer', query] as const,
}

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

// ─── Queries ─────────────────────────────────────────────────

/** Fetch conversation list by folder + optional search */
export function useConversations(folder: string, search?: string) {
  const token = useToken()
  return useQuery({
    queryKey: inboxKeys.conversations(folder, search),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (folder === 'unlinked') params.set('unlinked', 'true')
      else if (folder === 'trash') params.set('status', 'closed')
      else params.set('status', folder)
      if (search) params.set('search', search)
      const res = await authFetch(`/api/inbox/conversations?${params}`, {}, token)
      const data = await res.json()
      return (data.conversations || []).map((c: any) => ({
        ...c,
        from: c.customer_name ? `${c.customer_name} <${c.customer_email || ''}>` : (c.customer_email || 'Unknown'),
        subject: c.subject || '(no subject)',
        snippet: c.snippet || c.preview || '',
        date: c.last_message_at || c.created_at,
        unread: c.is_unread || false,
      }))
    },
    enabled: !!token,
  })
}

/** Fetch a single conversation with messages and notes */
export function useConversation(threadId: string | null) {
  const token = useToken()
  return useQuery({
    queryKey: inboxKeys.conversation(threadId || ''),
    queryFn: async () => {
      const res = await authFetch(`/api/inbox/conversations/${threadId}`, {}, token)
      const data = await res.json()
      const messages = (data.messages || []).map((m: any) => ({
        ...m,
        from: m.from_name ? `${m.from_name} <${m.from_email || ''}>` : (m.from_email || m.from || ''),
        date: m.sent_at || m.created_at || m.date,
        body: m.body_html || m.body_text || m.body || '',
      }))
      return { conversation: data.conversation, messages, notes: data.notes || [] }
    },
    enabled: !!threadId && !!token,
  })
}

/** Fetch folder counts */
export function useInboxCounts() {
  const token = useToken()
  return useQuery({
    queryKey: inboxKeys.counts(),
    queryFn: async () => {
      const res = await authFetch('/api/inbox/counts', {}, token)
      const data = await res.json()
      return {
        open: data.open || 0,
        pending: data.pending || 0,
        resolved: data.resolved || 0,
        unlinked: data.unlinked || 0,
        trash: data.trash || 0,
      }
    },
    enabled: !!token,
  })
}

/** Check if email account is connected */
export function useEmailAccounts() {
  const token = useToken()
  return useQuery({
    queryKey: inboxKeys.accounts(),
    queryFn: async () => {
      const res = await authFetch('/api/inbox/accounts', {}, token)
      const data = await res.json().catch(() => ({}))
      return { connected: Boolean(data?.accounts?.length > 0) }
    },
    enabled: !!token,
  })
}

/** Fetch Shopify customer by email or order number */
export function useCustomer(query: string) {
  const token = useToken()
  const isOrder = /^#?\d+$/.test(query.trim())
  const param = isOrder
    ? `order=${encodeURIComponent(query.trim().replace(/^#/, ''))}`
    : `email=${encodeURIComponent(query.trim())}`
  return useQuery({
    queryKey: inboxKeys.customer(query),
    queryFn: async () => {
      const res = await authFetch(`/api/shopify/customer?${param}`, {}, token)
      return res.json()
    },
    enabled: !!query.trim() && !!token,
  })
}

// ─── Mutations ───────────────────────────────────────────────

/** Send reply to a conversation */
export function useSendReply() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ threadId, bodyHtml, bodyText }: { threadId: string; bodyHtml: string; bodyText: string }) => {
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

/** Add internal note */
export function useAddNote() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ threadId, body }: { threadId: string; body: string }) => {
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

/** Update conversation status */
export function useUpdateStatus() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ threadId, status }: { threadId: string; status: string }) => {
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

/** AI analyze threads */
export function useAnalyzeThreads() {
  const token = useToken()
  return useMutation({
    mutationFn: async (threads: any[]) => {
      const res = await authFetch(
        '/api/ai/analyze',
        {
          method: 'POST',
          body: JSON.stringify({
            threads: threads.slice(0, 25).map((t) => ({ id: t.id, subject: t.subject, snippet: t.snippet })),
          }),
        },
        token,
      )
      const data = await res.json()
      return data.analyses || {}
    },
  })
}

/** AI generate reply */
export function useAIReply() {
  const token = useToken()
  return useMutation({
    mutationFn: async ({ threadId, messages }: { threadId: string; messages: any[] }) => {
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

/** Translate message */
export function useTranslateMessage() {
  const token = useToken()
  return useMutation({
    mutationFn: async ({ text, targetLang }: { text: string; targetLang?: string }) => {
      const res = await authFetch(
        '/api/ai/translate',
        { method: 'POST', body: JSON.stringify(targetLang ? { text, targetLang } : { text }) },
        token,
      )
      return res.json()
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

/** Shopify order actions */
export function useShopifyAction() {
  const token = useToken()
  return useMutation({
    mutationFn: async ({ url, method = 'POST', body }: { url: string; method?: string; body?: any }) => {
      const res = await authFetch(url, { method, body: body ? JSON.stringify(body) : undefined }, token)
      return res.json()
    },
  })
}
