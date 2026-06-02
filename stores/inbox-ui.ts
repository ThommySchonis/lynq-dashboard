import { create } from 'zustand'

interface InboxUIState {
  selectedThreadId: string | null
  reply: string
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
  showAllStores: boolean

  // Actions
  setSelectedThreadId: (id: string | null) => void
  setReply: (v: string) => void
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
  setShowAllStores: (v: boolean) => void
  resetForNewThread: () => void
}

export const useInboxUI = create<InboxUIState>()((set) => ({
  selectedThreadId: null,
  reply: '',
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
  showAllStores: false,

  setSelectedThreadId: (id) => set({ selectedThreadId: id }),
  setReply: (v) => set({ reply: v }),
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
  setShowAllStores: (v) => set({ showAllStores: v }),
  resetForNewThread: () => set({
    reply: '',
    showMacros: false,
    showEmoji: false,
    attachments: [],
    noteInput: '',
    showNotes: true,
  }),
}))
