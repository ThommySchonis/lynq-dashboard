'use client'

import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { authFetch } from '@/lib/inbox-utils'
import { apiUrl } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth'
import { parseJson } from '@/lib/utils/typed-json'
import { useStoreStore } from '@/stores/store'
import { useInboxUI } from '@/stores/inbox-ui'
import type { Thread, Message, Note, ConversationTag } from '@/types/inbox'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const inboxKeys = {
  all: ['inbox'] as const,
  conversations: (
    folder: string,
    search?: string,
    storeId?: string | null,
    emailAccountId?: string | null,
  ) => [...inboxKeys.all, 'conversations', folder, search, storeId, emailAccountId] as const,
  conversation: (id: string) => [...inboxKeys.all, 'conversation', id] as const,
  counts: (storeId?: string | null, emailAccountId?: string | null, search?: string) =>
    [...inboxKeys.all, 'counts', storeId, emailAccountId, search] as const,
  accounts: () => [...inboxKeys.all, 'accounts'] as const,
  accountsByStore: (storeId: string | null) =>
    [...inboxKeys.all, 'accounts', 'by-store', storeId] as const,
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
  tags?: ConversationTag[]
}

interface InboxCountsResponse {
  open?: number
  pending?: number
  resolved?: number
  snoozed?: number
  spam?: number
  unlinked?: number
  trash?: number
}

interface ComposeMacrosResponse {
  macros?: ComposeMacro[]
}

interface AccountsResponse {
  accounts?: AccountRecord[]
}

// Must match the backend page size (`limit`) in
// supabase/functions/api/routes/inbox-conversations.ts. A full page implies
// another page may exist; a short page means we've reached the end.
const CONVERSATIONS_PAGE_SIZE = 50

/** Fetch conversation list by folder + optional search, paginated (infinite). */
export function useConversations(folder: string, search: string) {
  const token = useToken()
  const activeStoreId = useStoreStore((s) => s.activeStoreId)
  const selectedEmailAccountId = useInboxUI((s) => s.selectedEmailAccountId)
  return useInfiniteQuery({
    queryKey: inboxKeys.conversations(folder, search, activeStoreId, selectedEmailAccountId),
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<Thread[]> => {
      const params = new URLSearchParams()
      if (folder === 'unlinked') params.set('unlinked', 'true')
      else if (folder === 'trash') params.set('status', 'closed')
      else if (folder === 'spam') params.set('spam', 'true')
      else params.set('status', folder) // open | pending | resolved | snoozed
      if (search) params.set('search', search)
      if (activeStoreId) params.set('store_id', activeStoreId)
      if (selectedEmailAccountId) params.set('email_account_id', selectedEmailAccountId)
      params.set('page', String(pageParam))
      const res = await authFetch(`${apiUrl('inbox/conversations')}?${params}`, {}, token)
      const data = await parseJson<ConversationsResponse>(res)
      return ((data.conversations || []) as Array<Record<string, unknown>>).map((c) => ({
        ...c,
        from: c.customer_name
          ? `${String(c.customer_name)} <${String(c.customer_email || '')}>`
          : String(c.customer_email || '') || 'Unknown',
        subject: String(c.subject || '') || '(no subject)',
        snippet: String(c.snippet || c.preview || ''),
        date: String(c.last_message_at || c.created_at || ''),
        unread: (c.is_unread || false) as boolean,
        tags: (c.tags as unknown as ConversationTag[]) || [],
      })) as Thread[]
    },
    getNextPageParam: (lastPage: Thread[], allPages: Thread[][]) =>
      lastPage.length === CONVERSATIONS_PAGE_SIZE ? allPages.length : undefined,
    // Flatten pages so every consumer keeps seeing a plain Thread[] in `data`;
    // the list panel still uses fetchNextPage/hasNextPage for infinite scroll.
    select: (data) => data.pages.flat(),
    enabled: !!token,
  })
}

export interface ConversationData {
  conversation: Thread | null
  messages: Message[]
  notes: Note[]
  tags: ConversationTag[]
}

/** Fetch a single conversation with messages and notes */
export function useConversation(threadId: string | null) {
  const token = useToken()
  return useQuery<ConversationData>({
    queryKey: inboxKeys.conversation(threadId || ''),
    queryFn: async (): Promise<ConversationData> => {
      const res = await authFetch(apiUrl(`inbox/conversations/${threadId}`), {}, token)
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
        tags: (data.tags || []) as ConversationTag[],
      }
    },
    enabled: !!threadId && !!token,
  })
}

/** Fetch folder counts — scoped to the active search so badges match the list. */
export function useInboxCounts() {
  const token = useToken()
  const activeStoreId = useStoreStore((s) => s.activeStoreId)
  const selectedEmailAccountId = useInboxUI((s) => s.selectedEmailAccountId)
  const search = useInboxUI((s) => s.search)
  return useQuery({
    queryKey: inboxKeys.counts(activeStoreId, selectedEmailAccountId, search),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (activeStoreId) params.set('store_id', activeStoreId)
      if (selectedEmailAccountId) params.set('email_account_id', selectedEmailAccountId)
      if (search) params.set('search', search)
      const qs = params.toString()
      const url = qs ? `${apiUrl('inbox/counts')}?${qs}` : apiUrl('inbox/counts')
      const res = await authFetch(url, {}, token)
      const data = await parseJson<InboxCountsResponse>(res)
      return {
        open: data.open || 0,
        pending: data.pending || 0,
        resolved: data.resolved || 0,
        snoozed: data.snoozed || 0,
        spam: data.spam || 0,
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
      const res = await authFetch(`${apiUrl('shopify/customer')}?${param}${storeParam}`, {}, token)
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
export function useComposeMacros(enabled = true) {
  const token = useToken()
  return useQuery<ComposeMacro[]>({
    queryKey: inboxKeys.macros(),
    queryFn: async (): Promise<ComposeMacro[]> => {
      const res = await authFetch(apiUrl('macros'), {}, token)
      const data = await parseJson<ComposeMacrosResponse>(res)
      if (data.macros?.length) return data.macros
      // Fallback to localStorage
      try {
        const stored: unknown = JSON.parse(localStorage.getItem('lynq_macros') || 'null')
        if (Array.isArray(stored) && stored.length) return stored as ComposeMacro[]
      } catch { /* ignore */ }
      return []
    },
    enabled: enabled && !!token,
  })
}

interface AccountRecord {
  status?: string
  provider?: string
  email_address?: string
}

export interface EmailAccountForStore {
  id: string
  provider: string
  email_address: string
  display_name: string | null
  status: string
  is_default: boolean
}

/** Check if the active store has a connected email account. Store-scoped so a
 *  store with no mailbox shows the connect-email empty state instead of another
 *  store's inbox (matches the store-scoped mailbox switcher). */
export function useEmailConnected() {
  const token = useToken()
  const activeStoreId = useStoreStore((s) => s.activeStoreId)
  return useQuery({
    queryKey: [...inboxKeys.accountsByStore(activeStoreId), 'connected'] as const,
    queryFn: async () => {
      const qs = activeStoreId ? `?store_id=${encodeURIComponent(activeStoreId)}` : ''
      const res = await authFetch(apiUrl(`inbox/accounts${qs}`), {}, token)
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

interface AccountsByStoreResponse {
  accounts?: EmailAccountForStore[]
}

/** Fetch email accounts for a specific store (used by the Inbox mailbox switcher). */
export function useEmailAccountsForStore(storeId: string | null, enabled = true) {
  const token = useToken()
  return useQuery<EmailAccountForStore[]>({
    queryKey: inboxKeys.accountsByStore(storeId),
    queryFn: async () => {
      const res = await authFetch(
        `${apiUrl('inbox/accounts')}?store_id=${encodeURIComponent(storeId ?? '')}`,
        {},
        token,
      )
      const data = await parseJson<AccountsByStoreResponse>(res).catch(
        (): AccountsByStoreResponse => ({ accounts: [] }),
      )
      return data.accounts ?? []
    },
    enabled: enabled && !!token && !!storeId,
    staleTime: 5 * 60_000,
  })
}
