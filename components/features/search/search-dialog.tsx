'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Command, CommandInput } from '@/components/ui/command'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useSearchStore } from '@/stores/search'
import { useGlobalSearch, type SearchTab } from '@/hooks/use-global-search'
import { SearchResultsList } from './search-results-list'
import { cn } from '@/lib/utils'

const DEBOUNCE_MS = 300
const QUERY_MIN_LENGTH = 2

const TABS: { value: SearchTab; label: string }[] = [
  { value: 'all',           label: 'All' },
  { value: 'conversations', label: 'Conversations' },
  { value: 'messages',      label: 'Messages' },
  { value: 'contacts',      label: 'Contacts' },
  { value: 'shopify',       label: 'Shopify customers' },
]

export function SearchDialog() {
  const isOpen = useSearchStore((s) => s.isOpen)
  const close = useSearchStore((s) => s.close)
  const recentSearches = useSearchStore((s) => s.recentSearches)
  const addRecent = useSearchStore((s) => s.addRecent)
  const clearRecent = useSearchStore((s) => s.clearRecent)
  const router = useRouter()

  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [activeTab, setActiveTab] = useState<SearchTab>('all')

  // Reset state on close.
  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery('')
      setDebounced('')
      setActiveTab('all')
    }
  }, [isOpen])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  const {
    conversations, messages, contacts, shopifyCustomers,
    isLoading, supabaseError, shopifyError, hasAnyResult,
  } = useGlobalSearch(debounced, activeTab)

  const showRecents = debounced.length < QUERY_MIN_LENGTH

  // Save recent only when there's at least one result.
  useEffect(() => {
    if (!hasAnyResult || debounced.length < QUERY_MIN_LENGTH) return
    addRecent(debounced) // effect calls a store action — does not set local state, no lint disable needed
  }, [hasAnyResult, debounced, addRecent])

  const handleSelect = useMemo(() => {
    return (selection: Parameters<React.ComponentProps<typeof SearchResultsList>['onSelect']>[0]) => {
      const params = new URLSearchParams()
      switch (selection.kind) {
        case 'conversation':
          params.set('conversation_id', selection.result.id)
          break
        case 'message':
          // No message-anchor support in v1 — route to its conversation.
          params.set('conversation_id', selection.result.conversation_id)
          break
        case 'contact':
          params.set('customer_email', selection.result.email)
          break
        case 'shopify': {
          const email = selection.result.email
          if (email) params.set('customer_email', email)
          break
        }
      }
      const target = params.toString() ? `/inbox?${params.toString()}` : '/inbox'
      router.push(target)
      close()
    }
  }, [router, close])

  const handleSeeAll = (tab: Exclude<SearchTab, 'all'>) => setActiveTab(tab)

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">
          Search across conversations, messages, contacts, and Shopify customers.
        </DialogDescription>

        <Command shouldFilter={false} className="rounded-none border-0">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search conversations, messages, contacts, Shopify customers…"
            autoFocus
          />

          <div className="flex gap-1 px-3 py-2 border-b border-border overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-md whitespace-nowrap',
                  activeTab === tab.value
                    ? 'bg-accent text-foreground'
                    : 'text-foreground-3 hover:text-foreground-2 hover:bg-accent/50',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {showRecents ? (
            <div className="px-3 py-3 max-h-[420px] overflow-y-auto">
              {recentSearches.length === 0 ? (
                <p className="text-xs text-foreground-3 px-1">Start typing to search…</p>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-xs text-foreground-3 uppercase tracking-wide">Recent</span>
                    <button
                      type="button"
                      onClick={clearRecent}
                      className="text-xs text-foreground-3 hover:text-foreground-2"
                    >
                      Clear
                    </button>
                  </div>
                  <ul className="space-y-0.5">
                    {recentSearches.map((entry) => (
                      <li key={entry}>
                        <button
                          type="button"
                          onClick={() => setQuery(entry)}
                          className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent"
                        >
                          {entry}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ) : (
            <SearchResultsList
              query={debounced}
              activeTab={activeTab}
              conversations={conversations}
              messages={messages}
              contacts={contacts}
              shopifyCustomers={shopifyCustomers}
              supabaseError={supabaseError}
              shopifyError={shopifyError}
              isLoading={isLoading}
              hasAnyResult={hasAnyResult}
              onSelect={handleSelect}
              onSeeAll={handleSeeAll}
            />
          )}
        </Command>
      </DialogContent>
    </Dialog>
  )
}
