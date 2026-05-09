import { create } from 'zustand'

export interface Toast {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'destructive' | 'success'
}

interface UIState {
  sidebarCollapsed: boolean
  activeModal: string | null

  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  openModal: (id: string) => void
  closeModal: () => void
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarCollapsed: false,
  activeModal: null,

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setSidebarCollapsed: (collapsed) =>
    set({ sidebarCollapsed: collapsed }),

  openModal: (id) => set({ activeModal: id }),

  closeModal: () => set({ activeModal: null }),
}))
