import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  toggle: () => void
  setTheme: (theme: Theme) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'light',

      toggle: () =>
        set((state) => {
          const next = state.theme === 'light' ? 'dark' : 'light'
          return { theme: next }
        }),

      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'lynq-theme-store',
      partialize: (state) => ({ theme: state.theme }),
    },
  ),
)
