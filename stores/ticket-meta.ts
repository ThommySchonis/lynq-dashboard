import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TicketMeta } from '@/types'

interface TicketMetaState {
  meta: Record<string, TicketMeta>
  addTag: (threadId: string, tag: string) => void
  removeTag: (threadId: string, tag: string) => void
  updateField: (threadId: string, key: keyof Omit<TicketMeta, 'tags'>, value: string | null) => void
  updateMeta: (threadId: string, patch: Partial<TicketMeta>) => void
  getMeta: (threadId: string) => TicketMeta
}

const DEFAULT_META: TicketMeta = {
  tags: [],
  assignee: 'Unassigned',
  contactReason: '',
  product: '',
  resolution: '',
}

export const useTicketMetaStore = create<TicketMetaState>()(
  persist(
    (set, get) => ({
      meta: {},

      addTag: (threadId, tag) =>
        set((state) => {
          const current = state.meta[threadId] || { ...DEFAULT_META }
          if (current.tags.includes(tag)) return state
          return { meta: { ...state.meta, [threadId]: { ...current, tags: [...current.tags, tag] } } }
        }),

      removeTag: (threadId, tag) =>
        set((state) => {
          const current = state.meta[threadId]
          if (!current) return state
          return { meta: { ...state.meta, [threadId]: { ...current, tags: current.tags.filter(t => t !== tag) } } }
        }),

      updateField: (threadId, key, value) =>
        set((state) => {
          const current = state.meta[threadId] || { ...DEFAULT_META }
          return { meta: { ...state.meta, [threadId]: { ...current, [key]: value } } }
        }),

      updateMeta: (threadId, patch) =>
        set((state) => {
          const current = state.meta[threadId] || { ...DEFAULT_META }
          return { meta: { ...state.meta, [threadId]: { ...current, ...patch } } }
        }),

      getMeta: (threadId) => get().meta[threadId] || DEFAULT_META,
    }),
    {
      name: 'lynq_ticket_meta',
    },
  ),
)
