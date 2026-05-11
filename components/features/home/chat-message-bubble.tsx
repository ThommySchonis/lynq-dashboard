'use client'

import type { ChatMessage } from '@/hooks/home'
import { LynqBadge } from './lynq-badge'
import { TypingDots } from './typing-dots'

export function ChatMessageBubble({ role, content, isStreaming }: ChatMessage) {
  const isUser = role === 'user'
  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3.5`}
      style={{ animation: 'msgIn .3s cubic-bezier(.16,1,.3,1) both' }}
    >
      {!isUser && (
        <div className="mr-2.5 mt-0.5 shrink-0">
          <LynqBadge />
        </div>
      )}
      <div className={isUser ? 'msg-user' : 'msg-ai'}>
        {isStreaming && !content ? (
          <TypingDots />
        ) : (
          content
        )}
        {isStreaming && content && (
          <span
            className="ml-0.5 inline-block h-3.5 w-0.5 bg-gray-500 align-text-bottom"
            style={{ animation: 'blink 1s ease-in-out infinite' }}
          />
        )}
      </div>
    </div>
  )
}
