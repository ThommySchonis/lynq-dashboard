import { create } from 'zustand'

interface AdminUIState {
  editingZoomId: string | null
  setEditingZoomId: (id: string | null) => void
}

export const useAdminUI = create<AdminUIState>()((set) => ({
  editingZoomId: null,
  setEditingZoomId: (id) => set({ editingZoomId: id }),
}))
