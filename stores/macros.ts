import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AiMacro {
  id: string
  name: string
  body?: string
  [key: string]: unknown
}

interface MacrosUIState {
  aiMacros: AiMacro[]
  favs: string[]

  setAiMacros: (macros: AiMacro[]) => void
  toggleFav: (id: string) => void
}

export const useMacrosStore = create<MacrosUIState>()(
  persist(
    (set) => ({
      aiMacros: [],
      favs: [],

      setAiMacros: (aiMacros) => set({ aiMacros }),

      toggleFav: (id) =>
        set((state) => ({
          favs: state.favs.includes(id)
            ? state.favs.filter((x) => x !== id)
            : [...state.favs, id],
        })),
    }),
    {
      name: 'lynq_macros_store',
      partialize: (state) => ({ favs: state.favs }),
    },
  ),
)
