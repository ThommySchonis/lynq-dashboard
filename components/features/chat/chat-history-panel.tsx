'use client'

import { useState } from 'react'
import { MessageSquare, Search, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface ChatHistoryPanelProps {
  /** Title of the current in-progress chat (first user message), if any. */
  activeTitle?: string
}

/**
 * Visual shell for the chat history sidebar. Real multi-chat persistence
 * (saved conversations, date grouping, search) is a backend feature — this
 * renders the current session only.
 */
export function ChatHistoryPanel({ activeTitle }: ChatHistoryPanelProps) {
  const [query, setQuery] = useState('')

  const matches =
    !!activeTitle && activeTitle.toLowerCase().includes(query.trim().toLowerCase())

  return (
    <aside className="hidden w-[264px] shrink-0 flex-col gap-3.5 border-r border-border bg-card px-4 py-5 lg:flex">
      <div className="flex items-center gap-1.5">
        <Sparkles className="size-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Lynq AI · Chats</span>
      </div>

      <div className="flex items-center gap-2 rounded-[9px] border border-border px-2.5 py-2">
        <Search className="size-3.5 shrink-0 text-foreground-4" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chats…"
          className="h-auto flex-1 border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="px-2 pb-1 pt-3 text-[12px] font-semibold text-foreground-4">TODAY</span>
        {activeTitle && matches ? (
          <div className="flex items-center gap-2.5 rounded-[8px] bg-accent-soft px-2.5 py-2.5">
            <MessageSquare className="size-3.5 shrink-0 text-primary" />
            <span className="truncate text-[13px] font-semibold text-primary">{activeTitle}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-[8px] px-2.5 py-2.5">
            <MessageSquare className="size-3.5 shrink-0 text-foreground-4" />
            <span className="truncate text-[13px] text-foreground-3">
              {query ? 'No matching chats' : 'Empty chat'}
            </span>
          </div>
        )}
      </div>
    </aside>
  )
}
