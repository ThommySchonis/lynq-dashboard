'use client'

import { Sparkles } from 'lucide-react'
import type { ChatMessage as ChatMessageData } from '@/hooks/home'
import { cn } from '@/lib/utils'
import { TypingDots } from './typing-dots'

export function ChatMessage({ role, content, isStreaming }: ChatMessageData) {
  const isUser = role === 'user'

  return (
    <div className={cn('mb-4 flex animate-msg-in', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="mr-3 mt-0.5 flex size-[30px] shrink-0 items-center justify-center rounded-[9px] bg-primary text-primary-foreground">
          <Sparkles className="size-3.5" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[72%] whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground',
          isUser
            ? 'rounded-[16px_16px_4px_16px] bg-accent-soft px-4 py-3'
            : 'rounded-[16px_16px_16px_4px] border border-border bg-card px-4 py-3',
        )}
      >
        {isStreaming && !content ? (
          <TypingDots />
        ) : (
          content
        )}
        {isStreaming && content && (
          <span className="ml-0.5 inline-block h-3.5 w-0.5 bg-foreground-3 align-text-bottom animate-blink" />
        )}
      </div>
    </div>
  )
}
