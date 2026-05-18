'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { StorePublic } from '@/types/stores'

interface StoreState {
  stores: StorePublic[]
  activeStore: StorePublic | null
  activeStoreId: string | null
  isLoading: boolean
  setStores: (stores: StorePublic[]) => void
  setActiveStore: (store: StorePublic) => void
  clearStores: () => void
  setLoading: (loading: boolean) => void
}

export const useStoreStore = create<StoreState>()(
  persist(
    (set, get) => ({
      stores: [],
      activeStore: null,
      activeStoreId: null,
      isLoading: true,

      setStores: (stores) => {
        const current = get()
        // Restore persisted selection if still valid
        const persisted = current.activeStoreId
        const match = stores.find((s) => s.id === persisted)
        const active = match ?? stores[0] ?? null

        set({
          stores,
          activeStore: active,
          activeStoreId: active?.id ?? null,
          isLoading: false,
        })
      },

      setActiveStore: (store) => {
        set({ activeStore: store, activeStoreId: store.id })
      },

      clearStores: () => {
        set({ stores: [], activeStore: null, activeStoreId: null, isLoading: false })
      },

      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'lynq-active-store',
      partialize: (state) => ({ activeStoreId: state.activeStoreId }),
    }
  )
)
