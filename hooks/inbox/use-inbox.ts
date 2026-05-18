'use client'

import { useMemo } from 'react'
import { useAuthStore } from '@/stores/auth'
import { useInboxStore } from '@/stores/inbox'
import type { Thread } from '@/types'

/**
 * Convenience hook that wraps inbox store actions with the auth token.
 * IMPORTANT: Only returns action functions — does NOT subscribe to store state.
 * Components should read state directly via useInboxStore((s) => s.someField).
 */
export function useInbox() {
  const token = useAuthStore((s) => s.session?.access_token ?? '')

  // Get stable references to store actions (these never change)
  const loadConversations = useInboxStore((s) => s.loadConversations)
  const selectThread = useInboxStore((s) => s.selectThread)
  const sendReply = useInboxStore((s) => s.sendReply)
  const addNote = useInboxStore((s) => s.addNote)
  const updateStatus = useInboxStore((s) => s.updateStatus)
  const triggerSync = useInboxStore((s) => s.triggerSync)
  const fetchCounts = useInboxStore((s) => s.fetchCounts)
  const searchCustomer = useInboxStore((s) => s.searchCustomer)

  return useMemo(() => ({
    load: (folder?: string) => loadConversations(token, folder),
    select: (thread: Thread) => selectThread(thread, token),
    send: (threadId: string, html: string) => sendReply(threadId, html, token),
    note: (threadId: string, text: string) => addNote(threadId, text, token),
    status: (id: string, s: string) => updateStatus(id, s, token),
    sync: () => triggerSync(token),
    counts: () => fetchCounts(token),
    custSearch: (q: string) => searchCustomer(q, token),
  }), [token, loadConversations, selectThread, sendReply, addNote, updateStatus, triggerSync, fetchCounts, searchCustomer])
}
