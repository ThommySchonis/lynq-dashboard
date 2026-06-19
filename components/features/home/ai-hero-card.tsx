'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUp, Search, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SUGGESTIONS, CHAT_ROUTE } from '@/lib/home-constants'

export function AiHeroCard() {
  const router = useRouter()
  const [input, setInput] = useState('')

  function start(query: string) {
    const trimmed = query.trim()
    if (!trimmed) return
    router.push(`${CHAT_ROUTE}?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <section className="flex flex-col gap-[18px] rounded-[20px] border border-accent-border bg-card p-8 shadow-card">
      <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-primary">
        <Sparkles className="size-3.5" />
        Lynq AI
      </div>

      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Ask anything about your store
        </h2>
        <p className="text-sm leading-relaxed text-foreground-3">
          Revenue, refunds, orders and trends — answered in seconds from your live store data.
        </p>
      </div>

      <div className="flex items-center gap-2.5 rounded-[14px] border border-accent-border bg-input px-4 py-2">
        <Search className="size-4 shrink-0 text-foreground-4" strokeWidth={2} />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              start(input)
            }
          }}
          placeholder="Ask Lynq AI about revenue, orders, refunds…"
          className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0"
        />
        <Button
          onClick={() => start(input)}
          disabled={!input.trim()}
          aria-label="Ask Lynq AI"
          size="icon"
        >
          <ArrowUp className="size-4" strokeWidth={2.5} />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((text) => (
          <Button
            key={text}
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => start(text)}
          >
            {text}
          </Button>
        ))}
      </div>
    </section>
  )
}
