import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const RECENT_MAX = 5
const QUERY_MIN_LENGTH = 2

interface SearchState {
  isOpen: boolean
  recentSearches: string[]
  open: () => void
  close: () => void
  addRecent: (q: string) => void
  clearRecent: () => void
}

export const useSearchStore = create<SearchState>()(
  persist(
    (set) => ({
      isOpen: false,
      recentSearches: [],
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      addRecent: (q) => {
        const trimmed = q.trim()
        if (trimmed.length < QUERY_MIN_LENGTH) return
        set((state) => {
          const without = state.recentSearches.filter(
            (entry) => entry.toLowerCase() !== trimmed.toLowerCase(),
          )
          return { recentSearches: [trimmed, ...without].slice(0, RECENT_MAX) }
        })
      },
      clearRecent: () => set({ recentSearches: [] }),
    }),
    {
      name: 'lynq:search',
      // Only persist recents, not the open flag.
      partialize: (state) => ({ recentSearches: state.recentSearches }),
    },
  ),
)
