'use client'

import { useMemo } from 'react'
import { useAuthStore } from '@/stores/auth'
import { useAIStore } from '@/stores/ai'
import type { Thread, Message } from '@/types'

/**
 * Convenience hook that wraps AI store actions with the auth token.
 * IMPORTANT: Only returns action functions — does NOT subscribe to store state.
 * Components should read state directly via useAIStore((s) => s.someField).
 */
export function useAI() {
  const token = useAuthStore((s) => s.session?.access_token ?? '')

  const analyzeThreads = useAIStore((s) => s.analyzeThreads)
  const generateReply = useAIStore((s) => s.generateReply)
  const translateMessage = useAIStore((s) => s.translateMessage)
  const detectLanguage = useAIStore((s) => s.detectLanguage)

  return useMemo(() => ({
    analyze: (threads: Thread[]) => analyzeThreads(threads, token),
    reply: (thread: Thread, messages: Message[]) => generateReply(thread, messages, token),
    translate: (msgId: string, text: string) => translateMessage(msgId, text, token),
    detect: (text: string) => detectLanguage(text, token),
  }), [token, analyzeThreads, generateReply, translateMessage, detectLanguage])
}
