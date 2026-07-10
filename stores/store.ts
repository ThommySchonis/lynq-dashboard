'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { StorePublic } from '@/types/stores'

interface StoreState {
  stores: StorePublic[]
  activeStore: StorePublic | null
  activeStoreId: string | null
  /** Persisted store selection, keyed by workspace id. */
  selectionByWorkspace: Record<string, string>
  isLoading: boolean
  setStores: (stores: StorePublic[], workspaceId: string | null) => void
  setActiveStore: (store: StorePublic, workspaceId: string | null) => void
  clearStores: () => void
  setLoading: (loading: boolean) => void
}

export const useStoreStore = create<StoreState>()(
  persist(
    (set, get) => ({
      stores: [],
      activeStore: null,
      activeStoreId: null,
      selectionByWorkspace: {},
      isLoading: true,

      setStores: (stores, workspaceId) => {
        const current = get()
        // Restore this workspace's persisted selection if still valid.
        const persisted = workspaceId ? current.selectionByWorkspace[workspaceId] : undefined
        const match = stores.find((s) => s.id === persisted)
        const active = match ?? stores[0] ?? null

        set({
          stores,
          activeStore: active,
          activeStoreId: active?.id ?? null,
          isLoading: false,
        })
      },

      setActiveStore: (store, workspaceId) => {
        set((state) => ({
          activeStore: store,
          activeStoreId: store.id,
          selectionByWorkspace: workspaceId
            ? { ...state.selectionByWorkspace, [workspaceId]: store.id }
            : state.selectionByWorkspace,
        }))
      },

      clearStores: () => {
        set({ stores: [], activeStore: null, activeStoreId: null, isLoading: false })
      },

      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'lynq-active-store',
      partialize: (state) => ({ selectionByWorkspace: state.selectionByWorkspace }),
    }
  )
)
