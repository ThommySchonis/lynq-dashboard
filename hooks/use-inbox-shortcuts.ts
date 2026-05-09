'use client'

import { useEffect } from 'react'
import { useInboxStore } from '@/stores/inbox'
import { useAuthStore } from '@/stores/auth'

export function useInboxShortcuts(composerRef?: React.RefObject<HTMLElement | null>) {
  const threads = useInboxStore((s) => s.threads)
  const selectedThreadId = useInboxStore((s) => s.selectedThreadId)
  const selectThread = useInboxStore((s) => s.selectThread)
  const token = useAuthStore((s) => s.session?.access_token ?? '')

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger when typing in inputs
      const tag = (e.target as HTMLElement).tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || (e.target as HTMLElement).isContentEditable) return

      if (e.key === 'j' || e.key === 'k') {
        e.preventDefault()
        const idx = threads.findIndex(t => t.id === selectedThreadId)
        const next = e.key === 'j' ? Math.min(idx + 1, threads.length - 1) : Math.max(idx - 1, 0)
        if (threads[next] && threads[next].id !== selectedThreadId) {
          selectThread(threads[next], token)
        }
      }

      if (e.key === 'r') {
        e.preventDefault()
        composerRef?.current?.focus()
      }

      if (e.key === 'Escape') {
        // Close macro panel / customer sheet — handled by dispatching a custom event
        // that the relevant components listen for
        window.dispatchEvent(new CustomEvent('inbox:escape'))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [threads, selectedThreadId, selectThread, token, composerRef])
}
