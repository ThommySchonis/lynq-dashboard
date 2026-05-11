import { create } from 'zustand'
import type { AcademyView } from '@/types/academy'

interface AcademyUIState {
  view: AcademyView
  selectedModuleId: string | null
  selectedLesson: number
  setView: (view: AcademyView) => void
  selectModule: (moduleId: string) => void
  selectLesson: (index: number) => void
  reset: () => void
}

export const useAcademyUI = create<AcademyUIState>()((set) => ({
  view: 'welcome',
  selectedModuleId: null,
  selectedLesson: 0,
  setView: (view) => set({ view }),
  selectModule: (moduleId) => set({ selectedModuleId: moduleId, selectedLesson: 0, view: 'module' }),
  selectLesson: (index) => set({ selectedLesson: index, view: 'lesson' }),
  reset: () => set({ view: 'welcome', selectedModuleId: null, selectedLesson: 0 }),
}))
