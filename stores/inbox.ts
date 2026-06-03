import { create } from 'zustand'
import { authFetch, extractEmail, sanitizeHtml, plainTextToSafeHtml } from '@/lib/inbox-utils'
import { apiUrl } from '@/lib/api-client'
import type {
  Thread,
  Message,
  Note,
  ShopifyCustomer,
  FolderCounts,
  InboxFolder,
  Macro,
} from '@/types'
import { useAIStore } from './ai'
import { useMacrosStore } from './macros'

// Raw API response shapes
interface RawConversation {
  customer_name?: string
  customer_email?: string
  subject?: string
  snippet?: string
  preview?: string
  last_message_at?: string
  created_at?: string
  is_unread?: boolean
  [key: string]: unknown
}

interface RawMessage {
  from_name?: string
  from_email?: string
  from?: string
  sent_at?: string
  created_at?: string
  date?: string
  body_html?: string
  body_text?: string
  body?: string
  [key: string]: unknown
}

interface ConversationsResponse {
  conversations?: RawConversation[]
}

interface ThreadDetailResponse {
  messages?: RawMessage[]
  notes?: Note[]
  conversation?: { customer_email?: string }
}

interface ReplyResponse {
  success?: boolean
  messageId?: string
  id?: string
}

interface NoteResponse {
  note?: Note
}

interface TranslationResponse {
  translated?: string
}

interface CountsResponse {
  open?: number
  pending?: number
  resolved?: number
  unlinked?: number
  trash?: number
}

interface AccountsResponse {
  accounts?: unknown[]
}

interface MacroSuggestionsResponse {
  macros?: Macro[]
}

interface InboxState {
  // Thread list
  threads: Thread[]
  loadingThreads: boolean
  activeFolder: InboxFolder
  search: string
  checkedThreads: Set<string>

  // Selected thread
  selectedThreadId: string | null
  messages: Message[]
  notes: Note[]
  loadingMessages: boolean

  // Customer
  customer: ShopifyCustomer | null
  loadingCustomer: boolean

  // Counts
  counts: FolderCounts

  // Sync
  syncing: boolean

  // Composer
  sending: boolean
  addingNote: boolean

  // Email connection
  emailConnected: boolean | null

  // Actions
  setActiveFolder: (folder: InboxFolder) => void
  setSearch: (search: string) => void
  setCheckedThreads: (ids: Set<string>) => void
  setSelectedThreadId: (id: string | null) => void

  loadConversations: (token: string, folder?: string) => Promise<void>
  selectThread: (thread: Thread, token: string) => Promise<void>
  sendReply: (threadId: string, html: string, token: string) => Promise<boolean>
  addNote: (threadId: string, text: string, token: string) => Promise<void>
  updateStatus: (id: string, status: string, token: string) => Promise<void>
  triggerSync: (token: string) => Promise<void>
  fetchCounts: (token: string) => Promise<void>
  searchCustomer: (query: string, token: string) => Promise<void>
  checkEmailConnected: (token: string) => Promise<void>
}

export const useInboxStore = create<InboxState>()((set, get) => ({
  // Thread list
  threads: [],
  loadingThreads: false,
  activeFolder: 'open',
  search: '',
  checkedThreads: new Set<string>(),

  // Selected thread
  selectedThreadId: null,
  messages: [],
  notes: [],
  loadingMessages: false,

  // Customer
  customer: null,
  loadingCustomer: false,

  // Counts
  counts: { open: 0, pending: 0, resolved: 0, unlinked: 0, trash: 0 },

  // Sync
  syncing: false,

  // Composer
  sending: false,
  addingNote: false,

  // Email connection
  emailConnected: null,

  // Setters
  setActiveFolder: (folder) => set({ activeFolder: folder }),
  setSearch: (search) => set({ search }),
  setCheckedThreads: (ids) => set({ checkedThreads: ids }),
  setSelectedThreadId: (id) => set({ selectedThreadId: id }),

  // Actions
  loadConversations: async (token, folder) => {
    set({ loadingThreads: true })
    const folderParam = folder || get().activeFolder
    const params = new URLSearchParams()
    if (folderParam === 'unlinked') params.set('unlinked', 'true')
    else if (folderParam === 'trash') params.set('status', 'closed')
    else params.set('status', folderParam)
    const { search } = get()
    if (search) params.set('search', search)
    try {
      const res = await authFetch(`/api/inbox/conversations?${params}`, {}, token)
      const data = (await res.json()) as ConversationsResponse
      const convs: Thread[] = (data.conversations ?? []).map((c: RawConversation) => ({
        ...c,
        from: c.customer_name
          ? `${c.customer_name} <${c.customer_email ?? ''}>`
          : (c.customer_email ?? 'Unknown'),
        subject: (c.subject as string) || '(no subject)',
        snippet: (c.snippet as string) || (c.preview as string) || '',
        date: (c.last_message_at as string) || (c.created_at as string),
        unread: (c.is_unread as boolean) || false,
      })) as Thread[]
      set({ threads: convs })
      // Trigger AI analysis in background
      void useAIStore.getState().analyzeThreads(convs, token)
    } catch {
      set({ threads: [] })
    }
    set({ loadingThreads: false })
  },

  selectThread: async (thread, token) => {
    set({
      selectedThreadId: thread.id,
      messages: [],
      notes: [],
      loadingMessages: true,
      customer: null,
    })
    try {
      const res = await authFetch(`/api/inbox/conversations/${thread.id}`, {}, token)
      const data = (await res.json()) as ThreadDetailResponse
      const msgs: Message[] = (data.messages ?? []).map((m: RawMessage) => ({
        ...m,
        from: m.from_name
          ? `${m.from_name} <${m.from_email ?? ''}>`
          : (m.from_email ?? m.from ?? ''),
        date: m.sent_at ?? m.created_at ?? m.date ?? '',
        body: m.body_html ?? m.body_text ?? m.body ?? '',
      })) as Message[]
      set({
        messages: msgs,
        notes: data.notes ?? [],
        loadingMessages: false,
      })

      // Mark read locally
      if (thread.unread) {
        set({
          threads: get().threads.map((t) =>
            t.id === thread.id ? { ...t, unread: false, is_unread: false } : t,
          ),
        })
      }

      // Fetch Shopify customer data
      const email =
        extractEmail(thread.from) || data.conversation?.customer_email
      if (email) {
        set({ loadingCustomer: true })
        try {
          const cr = await authFetch(
            `/api/shopify/customer?email=${encodeURIComponent(email)}`,
            {},
            token,
          )
          const cd = (await cr.json()) as ShopifyCustomer
          set({ customer: cd, loadingCustomer: false })
        } catch {
          set({ loadingCustomer: false })
        }

        // AI macro suggestions (fire and forget)
        void authFetch('/api/ai/macros', {
          method: 'POST',
          body: JSON.stringify({ subject: thread.subject, snippet: thread.snippet }),
        }, token)
          .then(r => r.json())
          .then((d: unknown) => {
            const resp = d as MacroSuggestionsResponse
            if (resp.macros?.length) useMacrosStore.getState().setAiMacros(resp.macros)
          })
          .catch(() => {})

        // Detect customer language from snippet
        if (thread.snippet) {
          void useAIStore.getState().detectLanguage(thread.snippet, token)
        }
      }
    } catch {
      set({ loadingMessages: false })
    }
  },

  sendReply: async (threadId, html, token) => {
    set({ sending: true })
    let bodyHtml = sanitizeHtml(html)
    let bodyText = html.replace(/<[^>]*>/g, '')

    // Auto-translate outgoing message if enabled
    const aiState = useAIStore.getState()
    if (aiState.autoTranslate && aiState.customerLang && aiState.customerLang.code !== 'en') {
      try {
        const tres = await authFetch(
          '/api/ai/translate',
          {
            method: 'POST',
            body: JSON.stringify({ text: bodyText, targetLang: aiState.customerLang.name }),
          },
          token,
        )
        const td = (await tres.json()) as TranslationResponse
        if (td.translated) {
          bodyHtml = plainTextToSafeHtml(td.translated)
          bodyText = td.translated
        }
      } catch {
        // Continue with original text
      }
    }

    try {
      const res = await authFetch(
        `/api/inbox/conversations/${threadId}/reply`,
        { method: 'POST', body: JSON.stringify({ bodyHtml, bodyText }) },
        token,
      )
      const data = (await res.json()) as ReplyResponse
      if (data.success || data.messageId || data.id) {
        // Reload conversations and counts
        void get().loadConversations(token)
        void get().fetchCounts(token)
        set({ sending: false })
        return true
      }
      set({ sending: false })
      return false
    } catch {
      set({ sending: false })
      return false
    }
  },

  addNote: async (threadId, text, token) => {
    if (!text.trim()) return
    set({ addingNote: true })
    try {
      const res = await authFetch(
        `/api/inbox/conversations/${threadId}/notes`,
        { method: 'POST', body: JSON.stringify({ body: text.trim() }) },
        token,
      )
      const data = (await res.json()) as NoteResponse
      if (data.note) {
        set({ notes: [...get().notes, data.note] })
      }
    } catch {
      // Error handling will be done by the component
    }
    set({ addingNote: false })
  },

  updateStatus: async (id, status, token) => {
    // Optimistic update
    set({
      threads: get().threads.map((t) =>
        t.id === id ? { ...t, status: status as Thread['status'] } : t,
      ),
    })
    // Persist via API
    await authFetch(
      `/api/inbox/conversations/${id}`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
      token,
    )
    void get().fetchCounts(token)
  },

  triggerSync: async (token) => {
    set({ syncing: true })
    try {
      await authFetch('/api/inbox/sync', { method: 'POST' }, token)
    } catch {
      // Sync failure is non-critical
    }
    set({ syncing: false })
  },

  fetchCounts: async (token) => {
    try {
      const res = await authFetch(apiUrl('inbox/counts'), {}, token)
      const data = (await res.json()) as CountsResponse
      set({
        counts: {
          open: data.open ?? 0,
          pending: data.pending ?? 0,
          resolved: data.resolved ?? 0,
          unlinked: data.unlinked ?? 0,
          trash: data.trash ?? 0,
        },
      })
    } catch {
      // Keep existing counts on error
    }
  },

  searchCustomer: async (query, token) => {
    if (!query.trim()) return
    set({ loadingCustomer: true, customer: null })
    const isOrder = /^#?\d+$/.test(query.trim())
    const param = isOrder
      ? `order=${encodeURIComponent(query.trim().replace(/^#/, ''))}`
      : `email=${encodeURIComponent(query.trim())}`
    try {
      const res = await authFetch(`/api/shopify/customer?${param}`, {}, token)
      const data = (await res.json()) as ShopifyCustomer
      set({ customer: data, loadingCustomer: false })
    } catch {
      set({ customer: null, loadingCustomer: false })
    }
  },

  checkEmailConnected: async (token) => {
    try {
      const res = await authFetch(apiUrl('inbox/accounts'), {}, token)
      const data = (await res.json().catch(() => ({}))) as AccountsResponse
      set({ emailConnected: Boolean(data?.accounts && data.accounts.length > 0) })
    } catch {
      set({ emailConnected: false })
    }
  },
}))
