import { create } from 'zustand'
import type { MacroFilter } from '@/types/settings'

interface SettingsUIState {
  // Tags page: bulk selection
  selectedTagIds: Set<string>
  toggleTagSelection: (id: string) => void
  selectAllTags: (ids: string[]) => void
  clearTagSelection: () => void

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

  macroFilter: { search: '', language: '', tags: [], archived: false },
  setMacroFilter: (filter) =>
    set((s) => ({ macroFilter: { ...s.macroFilter, ...filter } })),
}))
