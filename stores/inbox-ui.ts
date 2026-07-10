import { create } from 'zustand'

const EMAIL_ACCOUNT_LS_KEY = 'lynq-inbox-email-account'

function readPersistedEmailAccount(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(EMAIL_ACCOUNT_LS_KEY)
  } catch {
    return null
  }
}

function writePersistedEmailAccount(v: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (v === null) window.localStorage.removeItem(EMAIL_ACCOUNT_LS_KEY)
    else window.localStorage.setItem(EMAIL_ACCOUNT_LS_KEY, v)
  } catch {
    /* ignore quota / privacy errors */
  }
}

interface InboxUIState {
  selectedThreadId: string | null
  reply: string
  // Per-conversation composer snapshots (in-memory only). Keyed by thread id so
  // a draft typed/edited in one conversation is restored when the agent switches
  // back. Stores composer HTML to preserve formatting, plus the AI-draft id so a
  // restored draft still attributes correctly on send.
  composerDrafts: Record<string, { html: string; editingDraftId: string | null }>
  composerTab: 'reply' | 'note'
  showEmoji: boolean
  attachments: { name: string; size: number }[]
  showMacros: boolean
  showMacroManager: boolean
  showNotes: boolean
  noteInput: string
  rightTab: string
  custSearch: string
  expandedOrders: Record<string, boolean>
  expandedSubs: Record<string, boolean>
  custFieldsOpen: boolean
  custShowMore: boolean
  checkedThreads: Record<string, boolean>
  modal:
    | null
    | {
        type: string
        order?: { id: string | number; name?: string; [key: string]: unknown }
        customer?: { id: string | number; [key: string]: unknown }
        customerEmail?: string
        customerName?: string
      }
  activeFolder: string
  search: string
  sending: boolean
  addingNote: boolean
  syncing: boolean
  selectedEmailAccountId: string | null
  editingDraftId: string | null

  // Actions
  setSelectedThreadId: (id: string | null) => void
  setReply: (v: string) => void
  setComposerDraft: (threadId: string, draft: { html: string; editingDraftId: string | null }) => void
  clearComposerDraft: (threadId: string) => void
  setComposerTab: (v: 'reply' | 'note') => void
  setShowEmoji: (v: boolean) => void
  setAttachments: (v: { name: string; size: number }[] | ((prev: { name: string; size: number }[]) => { name: string; size: number }[])) => void
  setShowMacros: (v: boolean) => void
  setShowMacroManager: (v: boolean) => void
  setShowNotes: (v: boolean | ((prev: boolean) => boolean)) => void
  setNoteInput: (v: string) => void
  setRightTab: (v: string) => void
  setCustSearch: (v: string) => void
  setExpandedOrders: (v: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void
  setExpandedSubs: (v: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void
  setCustFieldsOpen: (v: boolean | ((prev: boolean) => boolean)) => void
  setCustShowMore: (v: boolean | ((prev: boolean) => boolean)) => void
  setCheckedThreads: (v: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void
  setModal: (v:
    | null
    | {
        type: string
        order?: { id: string | number; name?: string; [key: string]: unknown }
        customer?: { id: string | number; [key: string]: unknown }
        customerEmail?: string
        customerName?: string
      }) => void
  setActiveFolder: (v: string) => void
  setSearch: (v: string) => void
  setSending: (v: boolean) => void
  setAddingNote: (v: boolean) => void
  setSyncing: (v: boolean) => void
  setSelectedEmailAccountId: (v: string | null) => void
  setEditingDraftId: (v: string | null) => void
  resetForNewThread: () => void
}

export const useInboxUI = create<InboxUIState>()((set) => ({
  selectedThreadId: null,
  reply: '',
  composerDrafts: {},
  composerTab: 'reply',
  showEmoji: false,
  attachments: [],
  showMacros: false,
  showMacroManager: false,
  showNotes: true,
  noteInput: '',
  rightTab: 'shopify',
  custSearch: '',
  expandedOrders: {},
  expandedSubs: {},
  custFieldsOpen: true,
  custShowMore: false,
  checkedThreads: {},
  modal: null,
  activeFolder: 'open',
  search: '',
  sending: false,
  addingNote: false,
  syncing: false,
  selectedEmailAccountId: readPersistedEmailAccount(),
  editingDraftId: null,

  setSelectedThreadId: (id) => set({ selectedThreadId: id }),
  setReply: (v) => set({ reply: v }),
  setComposerDraft: (threadId, draft) =>
    set((s) => ({ composerDrafts: { ...s.composerDrafts, [threadId]: draft } })),
  clearComposerDraft: (threadId) =>
    set((s) => {
      if (!(threadId in s.composerDrafts)) return s
      const next = { ...s.composerDrafts }
      delete next[threadId]
      return { composerDrafts: next }
    }),
  setComposerTab: (v) => set({ composerTab: v }),
  setShowEmoji: (v) => set({ showEmoji: v }),
  setAttachments: (v) => set((s) => ({ attachments: typeof v === 'function' ? v(s.attachments) : v })),
  setShowMacros: (v) => set({ showMacros: v }),
  setShowMacroManager: (v) => set({ showMacroManager: v }),
  setShowNotes: (v) => set((s) => ({ showNotes: typeof v === 'function' ? v(s.showNotes) : v })),
  setNoteInput: (v) => set({ noteInput: v }),
  setRightTab: (v) => set({ rightTab: v }),
  setCustSearch: (v) => set({ custSearch: v }),
  setExpandedOrders: (v) => set((s) => ({ expandedOrders: typeof v === 'function' ? v(s.expandedOrders) : v })),
  setExpandedSubs: (v) => set((s) => ({ expandedSubs: typeof v === 'function' ? v(s.expandedSubs) : v })),
  setCustFieldsOpen: (v) => set((s) => ({ custFieldsOpen: typeof v === 'function' ? v(s.custFieldsOpen) : v })),
  setCustShowMore: (v) => set((s) => ({ custShowMore: typeof v === 'function' ? v(s.custShowMore) : v })),
  setCheckedThreads: (v) => set((s) => ({ checkedThreads: typeof v === 'function' ? v(s.checkedThreads) : v })),
  setModal: (v) => set({ modal: v }),
  setActiveFolder: (v) => set({ activeFolder: v }),
  setSearch: (v) => set({ search: v }),
  setSending: (v) => set({ sending: v }),
  setAddingNote: (v) => set({ addingNote: v }),
  setSyncing: (v) => set({ syncing: v }),
  setSelectedEmailAccountId: (v) => {
    writePersistedEmailAccount(v)
    set({ selectedEmailAccountId: v })
  },
  setEditingDraftId: (v) => set({ editingDraftId: v }),
  resetForNewThread: () => set({
    reply: '',
    showMacros: false,
    showEmoji: false,
    attachments: [],
    noteInput: '',
    showNotes: true,
    editingDraftId: null,
  }),
}))
