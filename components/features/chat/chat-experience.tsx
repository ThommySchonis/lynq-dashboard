'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowUp, Plus, Send } from 'lucide-react'
import { useHomeKpis, useAiChat } from '@/hooks/home'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SUGGESTIONS } from '@/lib/home-constants'
import { ChatMessage } from './chat-message'
import { ChatHistoryPanel } from './chat-history-panel'

export function ChatExperience() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [input, setInput] = useState('')
  const heroInputRef = useRef<HTMLInputElement>(null)
  const bottomInputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sentInitial = useRef(false)

  const { data: shopifyContext, isFetched: contextLoaded } = useHomeKpis()
  const { messages, isStreaming, sendMessage, clearMessages } = useAiChat()

  const hasMsg = messages.length > 0
  const activeTitle = messages.find((m) => m.role === 'user')?.content

  function handleSend(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    setInput('')
    void sendMessage(trimmed, shopifyContext ?? undefined)
  }

  // Auto-send the query passed from the home hero (?q=…) once context is ready.
  useEffect(() => {
    if (sentInitial.current) return
    const q = searchParams.get('q')?.trim()
    if (!q || !contextLoaded) return
    sentInitial.current = true
    void sendMessage(q, shopifyContext ?? undefined)
  }, [searchParams, contextLoaded, shopifyContext, sendMessage])

  // Auto-scroll on new messages.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus the follow-up composer after a stream finishes.
  useEffect(() => {
    if (!isStreaming && messages.length > 0) {
      const t = setTimeout(() => bottomInputRef.current?.focus(), 60)
      return () => clearTimeout(t)
    }
  }, [isStreaming, messages.length])

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(input)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ChatHistoryPanel activeTitle={activeTitle} />

      <div className="relative flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to home"
            onClick={() => router.push('/home')}
          >
            <ArrowLeft className="size-5" />
          </Button>
          <Button variant="outline" size="sm" onClick={clearMessages} disabled={isStreaming}>
            <Plus className="size-4" />
            New chat
          </Button>
        </header>

        {/* Empty / hero state */}
        {!hasMsg && (
          <div className="flex flex-1 items-center justify-center px-6 py-10">
            <div className="flex w-full max-w-[680px] flex-col items-center text-center">
              <h1 className="mb-3 text-3xl font-semibold tracking-tight text-foreground">
                Ask anything about your store
              </h1>
              <p className="mb-4 max-w-[420px] text-sm leading-relaxed text-foreground-3">
                Revenue, refunds, orders and trends — answered in seconds from your live store data.
              </p>
              <p className="mb-8 text-xs text-foreground-4">
                Lynq AI · Answers based on live store data · ↵ Enter to send
              </p>

              <div className="mb-5 flex w-full items-center gap-2.5 rounded-[14px] border border-accent-border bg-card p-2.5 shadow-card">
                <Input
                  ref={heroInputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKey}
                  placeholder={contextLoaded ? 'Ask Lynq AI about revenue, orders, refunds…' : 'Connecting…'}
                  disabled={!contextLoaded || isStreaming}
                  className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0"
                />
                <Button
                  onClick={() => handleSend(input)}
                  disabled={!input.trim() || isStreaming || !contextLoaded}
                  aria-label="Send"
                  size="icon"
                >
                  <ArrowUp className="size-4" strokeWidth={2.5} />
                </Button>
              </div>

              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((text) => (
                  <Button
                    key={text}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSend(text)}
                    disabled={isStreaming || !contextLoaded}
                    className="rounded-full"
                  >
                    {text}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Conversation */}
        {hasMsg && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="thin-scrollbar flex flex-1 flex-col items-center overflow-y-auto px-11 pb-4 pt-10">
              <div className="w-full max-w-[820px]">
                {messages.map((msg, i) => (
                  <ChatMessage key={i} {...msg} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="flex justify-center px-11 pb-7 pt-4">
              <div className="w-full max-w-[820px]">
                <div className="flex items-end gap-3 rounded-[14px] border border-accent-border bg-card py-3 pl-[18px] pr-3 shadow-card transition-colors focus-within:border-border-hover">
                  <textarea
                    ref={bottomInputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKey}
                    placeholder="Ask a follow-up…"
                    disabled={isStreaming}
                    rows={1}
                    className="max-h-[180px] w-full resize-none overflow-y-auto border-none bg-transparent p-0 text-sm leading-relaxed text-foreground outline-none placeholder:text-foreground-4"
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement
                      target.style.height = 'auto'
                      target.style.height = `${Math.min(target.scrollHeight, 180)}px`
                    }}
                  />
                  <Button
                    onClick={() => handleSend(input)}
                    disabled={!input.trim() || isStreaming}
                    aria-label="Send"
                    size="icon"
                  >
                    <Send className="size-4" strokeWidth={2.3} />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
