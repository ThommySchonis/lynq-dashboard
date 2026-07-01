import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SavedArticlesState {
  ids: string[]
  toggle: (id: string) => void
}

/**
 * Client-side "saved articles" for the Value Feed.
 * Bookmarks are stored in localStorage only (no backend) — the Saved tab and
 * the Save action read/write this store. Newest-saved first.
 */
export const useSavedArticlesStore = create<SavedArticlesState>()(
  persist(
    (set) => ({
      ids: [],
      toggle: (id) =>
        set((state) => ({
          ids: state.ids.includes(id)
            ? state.ids.filter((entry) => entry !== id)
            : [id, ...state.ids],
        })),
    }),
    { name: 'lynq:value-feed-saved' },
  ),
)
