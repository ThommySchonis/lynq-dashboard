import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TicketMeta } from '@/types'

interface TicketMetaState {
  meta: Record<string, TicketMeta>
  updateField: (threadId: string, key: keyof TicketMeta, value: string | null) => void
  updateMeta: (threadId: string, patch: Partial<TicketMeta>) => void
  getMeta: (threadId: string) => TicketMeta
}

const DEFAULT_META: TicketMeta = {
  tier: 'Unassigned',
  contactReason: '',
  product: '',
  resolution: '',
}

export const useTicketMetaStore = create<TicketMetaState>()(
  persist(
    (set, get) => ({
      meta: {},

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
