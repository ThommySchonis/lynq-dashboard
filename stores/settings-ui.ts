import { create } from 'zustand'
import type { MacroFilter } from '@/types/settings'

interface SettingsUIState {
  // Tags page: bulk selection
  selectedTagIds: Set<string>
  toggleTagSelection: (id: string) => void
  selectAllTags: (ids: string[]) => void
  clearTagSelection: () => void

  // Macros page: bulk selection
  selectedMacroIds: Set<string>
  toggleMacroSelection: (id: string) => void
  selectAllMacros: (ids: string[]) => void
  clearMacroSelection: () => void

  // Macros page: filter state
  macroFilter: MacroFilter
  setMacroFilter: (filter: Partial<MacroFilter>) => void
}

export const useSettingsUI = create<SettingsUIState>()((set) => ({
  selectedTagIds: new Set(),
  toggleTagSelection: (id) =>
    set((s) => {
      const next = new Set(s.selectedTagIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selectedTagIds: next }
    }),
  selectAllTags: (ids) => set({ selectedTagIds: new Set(ids) }),
  clearTagSelection: () => set({ selectedTagIds: new Set() }),

  selectedMacroIds: new Set(),
  toggleMacroSelection: (id) =>
    set((s) => {
      const next = new Set(s.selectedMacroIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selectedMacroIds: next }
    }),
  selectAllMacros: (ids) => set({ selectedMacroIds: new Set(ids) }),
  clearMacroSelection: () => set({ selectedMacroIds: new Set() }),

  macroFilter: { search: '', language: '', tags: [], archived: false },
  setMacroFilter: (filter) =>
    set((s) => ({ macroFilter: { ...s.macroFilter, ...filter } })),
}))
