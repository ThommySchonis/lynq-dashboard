'use client'

import { useEffect } from 'react'
import type { RefObject } from 'react'
import type { Thread } from '@/types/inbox'

interface UseKeyboardShortcutsOptions {
  threads: Thread[]
  selectedThreadId: string | null
  onSelectThread: (thread: Thread) => void
  composerRef: RefObject<HTMLDivElement | null>
}

export function useKeyboardShortcuts({
  threads,
  selectedThreadId,
  onSelectThread,
  composerRef,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (e.target as HTMLElement)?.isContentEditable
      )
        return

      if (e.key === 'j') {
        const idx = threads.findIndex((t) => t.id === selectedThreadId)
        if (idx < threads.length - 1) onSelectThread(threads[idx + 1])
      }

      if (e.key === 'k') {
        const idx = threads.findIndex((t) => t.id === selectedThreadId)
        if (idx > 0) onSelectThread(threads[idx - 1])
      }

      if (e.key === 'r' && selectedThreadId) {
        setTimeout(() => composerRef.current?.focus(), 10)
      }

      if (e.key === 'Escape') {
        window.dispatchEvent(new CustomEvent('inbox:escape'))
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [threads, selectedThreadId, onSelectThread, composerRef])
}
