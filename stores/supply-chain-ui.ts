import { create } from 'zustand'
import type { SupplyChainFilter } from '@/types/supply-chain'

interface SupplyChainUIState {
  filter: SupplyChainFilter
  search: string
  expandedOrderId: string | null
  dismissedKeys: Set<string>
  showAllAttention: boolean
  setFilter: (filter: SupplyChainFilter) => void
  setSearch: (search: string) => void
  toggleExpanded: (orderId: string) => void
  toggleExpandedOrderId: (orderId: string) => void
  dismiss: (key: string) => void
  toggleShowAllAttention: () => void
}

export const useSupplyChainUI = create<SupplyChainUIState>()((set) => ({
  filter: 'All',
  search: '',
  expandedOrderId: null,
  dismissedKeys: new Set(),
  showAllAttention: false,
  setFilter: (filter) => set({ filter }),
  setSearch: (search) => set({ search }),
  toggleExpanded: (orderId) =>
    set((s) => ({ expandedOrderId: s.expandedOrderId === orderId ? null : orderId })),
  toggleExpandedOrderId: (orderId) =>
    set((s) => ({ expandedOrderId: s.expandedOrderId === orderId ? null : orderId })),
  dismiss: (key) =>
    set((s) => {
      const next = new Set(s.dismissedKeys)
      next.add(key)
      return { dismissedKeys: next }
    }),
  toggleShowAllAttention: () =>
    set((s) => ({ showAllAttention: !s.showAllAttention })),
}))
