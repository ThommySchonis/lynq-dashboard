'use client'

import { useSavedArticlesStore } from '@/stores/saved-articles-store'

/** All saved article ids (newest-saved first). */
export function useSavedIds(): string[] {
  return useSavedArticlesStore((s) => s.ids)
}

/** Count of saved articles — for the Saved tab badge. */
export function useSavedCount(): number {
  return useSavedArticlesStore((s) => s.ids.length)
}

/** Reactive "is this article saved" check. */
export function useIsSaved(id: string): boolean {
  return useSavedArticlesStore((s) => s.ids.includes(id))
}

/** Toggle an article's saved state. */
export function useToggleSaved(): (id: string) => void {
  return useSavedArticlesStore((s) => s.toggle)
}
