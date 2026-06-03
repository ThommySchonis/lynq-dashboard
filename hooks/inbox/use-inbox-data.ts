'use client'

import { useQuery } from '@tanstack/react-query'
import { authFetch } from '@/lib/inbox-utils'
import { useAuthStore } from '@/stores/auth'
import { apiUrl } from '@/lib/api-client'
import { parseJson } from '@/lib/utils/typed-json'
import { useStoreStore } from '@/stores/store'
import { useInboxUI } from '@/stores/inbox-ui'
import type { Thread, Message, Note } from '@/types/inbox'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const inboxKeys = {
  all: ['inbox'] as const,
  conversations: (folder: string, search?: string, storeId?: string | null) =>
    [...inboxKeys.all, 'conversations', folder, search, storeId] as const,
  conversation: (id: string) => [...inboxKeys.all, 'conversation', id] as const,
  counts: (storeId?: string | null) => [...inboxKeys.all, 'counts', storeId] as const,
  accounts: () => [...inboxKeys.all, 'accounts'] as const,
  customer: (query: string, storeId: string | null) => ['customer', query, storeId] as const,
  macros: () => [...inboxKeys.all, 'macros'] as const,
}

interface ConversationsResponse {
  conversations?: Array<Record<string, string | boolean | null>>
}

interface ConversationDetailResponse {
  conversation?: Record<string, unknown>
  messages?: Array<Record<string, string | null>>
  notes?: Note[]
}

interface InboxCountsResponse {
  open?: number
  pending?: number
  resolved?: number
  unlinked?: number
  trash?: number
}

interface ComposeMacrosResponse {
  macros?: ComposeMacro[]
}

interface AccountsResponse {
  accounts?: AccountRecord[]
}

/** Fetch conversation list by folder + optional search */
export function useConversations(folder: string, search: string) {
  const token = useToken()
  const activeStoreId = useStoreStore((s) => s.activeStoreId)
  const showAllStores = useInboxUI((s) => s.showAllStores)
  const effectiveStoreId = showAllStores ? null : activeStoreId
  return useQuery<Thread[]>({
    queryKey: inboxKeys.conversations(folder, search, showAllStores ? 'all' : activeStoreId),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (folder === 'unlinked') params.set('unlinked', 'true')
      else if (folder === 'trash') params.set('status', 'closed')
      else params.set('status', folder)
      if (search) params.set('search', search)
      if (effectiveStoreId) params.set('store_id', effectiveStoreId)
      const res = await authFetch(`/api/inbox/conversations?${params}`, {}, token)
      const data = await parseJson<ConversationsResponse>(res)
      return ((data.conversations || []) as Array<Record<string, string | boolean | null>>).map((c) => ({
        ...c,
        from: c.customer_name
          ? `${c.customer_name} <${c.customer_email || ''}>`
          : (c.customer_email as string) || 'Unknown',
        subject: (c.subject as string) || '(no subject)',
        snippet: (c.snippet || c.preview || '') as string,
        date: (c.last_message_at || c.created_at) as string,
        unread: (c.is_unread || false) as boolean,
      })) as Thread[]
    },
    enabled: !!token,
  })
}

export interface ConversationData {
  conversation: Thread | null
  messages: Message[]
  notes: Note[]
}

/** Fetch a single conversation with messages and notes */
export function useConversation(threadId: string | null) {
  const token = useToken()
  return useQuery<ConversationData>({
    queryKey: inboxKeys.conversation(threadId || ''),
    queryFn: async (): Promise<ConversationData> => {
      const res = await authFetch(`/api/inbox/conversations/${threadId}`, {}, token)
      const data = await parseJson<ConversationDetailResponse>(res)
      const messages: Message[] = (data.messages || []).map((m: Record<string, string | null>) => ({
        ...m,
        from: m.from_name
          ? `${m.from_name} <${m.from_email || ''}>`
          : m.from_email || m.from || '',
        date: m.sent_at || m.created_at || m.date || '',
        body: m.body_html || m.body_text || m.body || '',
      })) as Message[]
      return {
        conversation: (data.conversation ?? null) as Thread | null,
        messages,
        notes: (data.notes || []) as Note[],
      }
    },
    enabled: !!threadId && !!token,
  })
}

/** Fetch folder counts */
export function useInboxCounts() {
  const token = useToken()
  const activeStoreId = useStoreStore((s) => s.activeStoreId)
  const showAllStores = useInboxUI((s) => s.showAllStores)
  const effectiveStoreId = showAllStores ? null : activeStoreId
  const params = effectiveStoreId ? `?store_id=${effectiveStoreId}` : ''
  return useQuery({
    queryKey: inboxKeys.counts(showAllStores ? 'all' : activeStoreId),
    queryFn: async () => {
      const res = await authFetch(`/api/inbox/counts${params}`, {}, token)
      const data = await parseJson<InboxCountsResponse>(res)
      return {
        open: data.open || 0,
        pending: data.pending || 0,
        resolved: data.resolved || 0,
        unlinked: data.unlinked || 0,
        trash: data.trash || 0,
      }
    },
    enabled: !!token,
    staleTime: 60_000,
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
      return parseJson<Record<string, unknown>>(res)
    },
    enabled: !!trimmed && !!token,
  })
}

interface ComposeMacro {
  id: string
  name: string
  body?: string
  tags?: string[]
  archived?: boolean
}

/** Fetch macros for compose (with localStorage fallback) */
export function useComposeMacros() {
  const token = useToken()
  return useQuery<ComposeMacro[]>({
    queryKey: inboxKeys.macros(),
    queryFn: async (): Promise<ComposeMacro[]> => {
      const res = await authFetch('/api/macros', {}, token)
      const data = await parseJson<ComposeMacrosResponse>(res)
      if (data.macros?.length) return data.macros
      // Fallback to localStorage
      try {
        const stored: unknown = JSON.parse(localStorage.getItem('lynq_macros') || 'null')
        if (Array.isArray(stored) && stored.length) return stored as ComposeMacro[]
      } catch { /* ignore */ }
      return []
    },
    enabled: !!token,
  })
}

interface AccountRecord {
  status?: string
  provider?: string
  email_address?: string
}

/** Check if email account is connected */
export function useEmailConnected() {
  const token = useToken()
  return useQuery({
    queryKey: inboxKeys.accounts(),
    queryFn: async () => {
      const res = await authFetch(apiUrl('inbox/accounts'), {}, token)
      const data = await parseJson<AccountsResponse>(res).catch((): AccountsResponse => ({}))
      return Boolean(data?.accounts && data.accounts.length > 0)
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
      const res = await authFetch(apiUrl('inbox/accounts'), {}, token)
      const data = await parseJson<AccountsResponse>(res).catch((): AccountsResponse => ({ accounts: [] }))
      const accounts = data?.accounts || []
      const active = accounts.find((a) => a.status === 'active')
      if (active) {
        return {
          connected: true,
          provider: active.provider ?? null,
          email: active.email_address ?? null,
        }
      }
      return { connected: false, provider: null, email: null }
    },
    enabled: !!token,
  })
}
