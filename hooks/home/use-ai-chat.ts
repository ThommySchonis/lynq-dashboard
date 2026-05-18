'use client'

import { useState, useRef, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth'
import type { ShopifyContext } from './use-home-data'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

export interface UseAiChatReturn {
  messages: ChatMessage[]
  isStreaming: boolean
  sendMessage: (text: string, context: ShopifyContext | undefined) => Promise<void>
  clearMessages: () => void
}

export function useAiChat(): UseAiChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const messagesRef = useRef<ChatMessage[]>([])
  messagesRef.current = messages

  const streamingRef = useRef(false)
  streamingRef.current = isStreaming

  const token = useAuthStore((s) => s.session?.access_token ?? '')

  const sendMessage = useCallback(
    async (text: string, context: ShopifyContext | undefined) => {
      const trimmed = text.trim()
      if (!trimmed || streamingRef.current || !token) return

      setIsStreaming(true)
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: trimmed },
        { role: 'assistant', content: '', isStreaming: true },
      ])

      try {
        const history = messagesRef.current
          .filter((m) => !m.isStreaming)
          .map((m) => ({ role: m.role, content: m.content }))

        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ message: trimmed, history, context }),
        })

        if (!res.ok || !res.body) throw new Error('Stream failed')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let accumulated = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          accumulated += decoder.decode(value, { stream: true })
          const snapshot = accumulated
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = {
              role: 'assistant',
              content: snapshot,
              isStreaming: true,
            }
            return updated
          })
        }

        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: accumulated,
            isStreaming: false,
          }
          return updated
        })
      } catch {
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: 'Something went wrong. Please try again.',
            isStreaming: false,
          }
          return updated
        })
      } finally {
        setIsStreaming(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token],
  )

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  return { messages, isStreaming, sendMessage, clearMessages }
}
