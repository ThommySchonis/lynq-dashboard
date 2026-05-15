'use client'

import { useQuery } from '@tanstack/react-query'
import { authFetch } from '@/lib/inbox-utils'
import { useAuthStore } from '@/stores/auth'
import { useStoreStore } from '@/stores/store'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const inboxKeys = {
  all: ['inbox'] as const,
  conversations: (folder: string, search?: string, storeId?: string | null) =>
    [...inboxKeys.all, 'conversations', folder, search, storeId] as const,
  conversation: (id: string) => [...inboxKeys.all, 'conversation', id] as const,
  counts: () => [...inboxKeys.all, 'counts'] as const,
  accounts: () => [...inboxKeys.all, 'accounts'] as const,
  customer: (query: string, storeId: string | null) => ['customer', query, storeId] as const,
  macros: () => [...inboxKeys.all, 'macros'] as const,
}

/** Fetch conversation list by folder + optional search */
export function useConversations(folder: string, search: string) {
  const token = useToken()
  const activeStoreId = useStoreStore((s) => s.activeStoreId)
  return useQuery({
    queryKey: inboxKeys.conversations(folder, search, activeStoreId),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (folder === 'unlinked') params.set('unlinked', 'true')
      else if (folder === 'trash') params.set('status', 'closed')
      else params.set('status', folder)
      if (search) params.set('search', search)
      if (activeStoreId) params.set('store_id', activeStoreId)
      const res = await authFetch(`/api/inbox/conversations?${params}`, {}, token)
      const data = await res.json()
      return (data.conversations || []).map((c: Record<string, string | boolean | null>) => ({
        ...c,
        from: c.customer_name
          ? `${c.customer_name} <${c.customer_email || ''}>`
          : c.customer_email || 'Unknown',
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
      const messages = (data.messages || []).map((m: Record<string, string | null>) => ({
        ...m,
        from: m.from_name
          ? `${m.from_name} <${m.from_email || ''}>`
          : m.from_email || m.from || '',
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

/** Fetch Shopify customer by email or order number */
export function useCustomerSearch(query: string) {
  const token = useToken()
  const activeStoreId = useStoreStore((s) => s.activeStoreId)
  const trimmed = query.trim()
  const isOrder = /^#?\d+$/.test(trimmed)
  const param = isOrder
    ? `order=${encodeURIComponent(trimmed.replace(/^#/, ''))}`
    : `email=${encodeURIComponent(trimmed)}`
  const storeParam = activeStoreId ? `&store_id=${activeStoreId}` : ''
  return useQuery({
    queryKey: inboxKeys.customer(query, activeStoreId),
    queryFn: async () => {
      const res = await authFetch(`/api/shopify/customer?${param}${storeParam}`, {}, token)
      return res.json()
    },
    enabled: !!trimmed && !!token,
  })
}

/** Fetch macros for compose (with localStorage fallback) */
export function useComposeMacros() {
  const token = useToken()
  return useQuery({
    queryKey: inboxKeys.macros(),
    queryFn: async () => {
      const res = await authFetch('/api/macros', {}, token)
      const data = await res.json()
      if (data.macros?.length) return data.macros as Array<{
        id: string
        name: string
        body?: string
        tags?: string[]
        archived?: boolean
      }>
      // Fallback to localStorage
      try {
        const stored = JSON.parse(localStorage.getItem('lynq_macros') || 'null')
        if (Array.isArray(stored) && stored.length) return stored
      } catch { /* ignore */ }
      return []
    },
    enabled: !!token,
  })
}

/** Check if email account is connected */
export function useEmailConnected() {
  const token = useToken()
  return useQuery({
    queryKey: inboxKeys.accounts(),
    queryFn: async () => {
      const res = await authFetch('/api/inbox/accounts', {}, token)
      const data = await res.json().catch(() => ({}))
      return Boolean(data?.accounts?.length > 0)
    },
    enabled: !!token,
  })
}

/** Fetch email account details (provider, email) for compose page */
export function useEmailAccountInfo() {
  const token = useToken()
  return useQuery({
    queryKey: [...inboxKeys.accounts(), 'info'] as const,
    queryFn: async () => {
      const res = await authFetch('/api/inbox/accounts', {}, token)
      const data = await res.json().catch(() => ({ accounts: [] }))
      const accounts = data?.accounts || []
      const active = accounts.find((a: Record<string, unknown>) => a.status === 'active')
      if (active) {
        return {
          connected: true,
          provider: active.provider as string,
          email: (active.email_address || null) as string | null,
        }
      }
      return { connected: false, provider: null, email: null }
    },
    enabled: !!token,
  })
}
