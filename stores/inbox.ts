import { create } from 'zustand'
import { authFetch, extractEmail, sanitizeHtml, plainTextToSafeHtml } from '@/lib/inbox-utils'
import type {
  Thread,
  Message,
  Note,
  ShopifyCustomer,
  FolderCounts,
  InboxFolder,
} from '@/types'
import { useAIStore } from './ai'
import { useMacrosStore } from './macros'

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
      const data = await res.json()
      const convs: Thread[] = (data.conversations || []).map((c: Record<string, unknown>) => ({
        ...c,
        from: c.customer_name
          ? `${c.customer_name} <${c.customer_email || ''}>`
          : ((c.customer_email as string) || 'Unknown'),
        subject: (c.subject as string) || '(no subject)',
        snippet: (c.snippet as string) || (c.preview as string) || '',
        date: (c.last_message_at as string) || (c.created_at as string),
        unread: (c.is_unread as boolean) || false,
      }))
      set({ threads: convs })
      // Trigger AI analysis in background
      useAIStore.getState().analyzeThreads(convs, token)
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
      const data = await res.json()
      const msgs: Message[] = (data.messages || []).map((m: Record<string, unknown>) => ({
        ...m,
        from: m.from_name
          ? `${m.from_name} <${m.from_email || ''}>`
          : ((m.from_email as string) || (m.from as string) || ''),
        date: (m.sent_at as string) || (m.created_at as string) || (m.date as string),
        body: (m.body_html as string) || (m.body_text as string) || (m.body as string) || '',
      }))
      set({
        messages: msgs,
        notes: data.notes || [],
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
          const cd = await cr.json()
          set({ customer: cd, loadingCustomer: false })
        } catch {
          set({ loadingCustomer: false })
        }

        // AI macro suggestions (fire and forget)
        authFetch('/api/ai/macros', {
          method: 'POST',
          body: JSON.stringify({ subject: thread.subject, snippet: thread.snippet }),
        }, token)
          .then(r => r.json())
          .then(d => {
            if (d.macros?.length) useMacrosStore.getState().setAiMacros(d.macros)
          })
          .catch(() => {})

        // Detect customer language from snippet
        if (thread.snippet) {
          useAIStore.getState().detectLanguage(thread.snippet, token)
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
        const td = await tres.json()
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
      const data = await res.json()
      if (data.success || data.messageId || data.id) {
        // Reload conversations and counts
        get().loadConversations(token)
        get().fetchCounts(token)
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
      const data = await res.json()
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
    get().fetchCounts(token)
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
      const res = await authFetch('/api/inbox/counts', {}, token)
      const data = await res.json()
      set({
        counts: {
          open: data.open || 0,
          pending: data.pending || 0,
          resolved: data.resolved || 0,
          unlinked: data.unlinked || 0,
          trash: data.trash || 0,
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
      const data = await res.json()
      set({ customer: data, loadingCustomer: false })
    } catch {
      set({ customer: null, loadingCustomer: false })
    }
  },

  checkEmailConnected: async (token) => {
    try {
      const res = await authFetch('/api/inbox/accounts', {}, token)
      const data = await res.json().catch(() => ({}))
      set({ emailConnected: Boolean(data?.accounts?.length > 0) })
    } catch {
      set({ emailConnected: false })
    }
  },
}))
