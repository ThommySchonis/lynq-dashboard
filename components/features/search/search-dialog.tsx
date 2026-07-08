'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Filter, Search } from 'lucide-react'
import { Command, CommandInput } from '@/components/ui/command'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useSearchStore } from '@/stores/search'
import { useGlobalSearch, type SearchTab } from '@/hooks/use-global-search'
import { SearchResultsList } from './search-results-list'
import { FilterPanel } from './filter-panel'
import { type SearchFilters, emptyFilters, hasActiveFilters, activeFilterCount } from './search-filters'
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
  const [mode, setMode] = useState<'results' | 'filters'>('results')
  const [staged, setStaged] = useState<SearchFilters>(emptyFilters())
  const [applied, setApplied] = useState<SearchFilters>(emptyFilters())

  // Reset state on close.
  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery('')
      setDebounced('')
      setActiveTab('all')
      setMode('results')
      setStaged(emptyFilters())
      setApplied(emptyFilters())
    }
  }, [isOpen])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  const {
    conversations, messages, contacts, shopifyCustomers,
    isLoading, supabaseError, shopifyError, hasAnyResult,
  } = useGlobalSearch(debounced, activeTab, applied)

  const showRecents = debounced.length < QUERY_MIN_LENGTH && !hasActiveFilters(applied)

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

  const openFilters = () => {
    setStaged(applied)
    setMode('filters')
  }
  const applyFilters = () => {
    setApplied(staged)
    setMode('results')
  }
  const appliedCount = activeFilterCount(applied)

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-2xl overflow-hidden rounded-2xl p-0 shadow-[0_24px_56px_rgba(28,15,54,0.28)]">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">
          Search across conversations, messages, contacts, and Shopify customers.
        </DialogDescription>

        <Command shouldFilter={false} className="rounded-none border-0">
          <div className="flex items-center gap-1 pr-3">
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search, or / for filter options"
              autoFocus
              className="flex-1"
            />
            <kbd
              onClick={close}
              className="shrink-0 cursor-pointer rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground-3"
            >
              Esc
            </kbd>
            <button
              type="button"
              onClick={() => (mode === 'filters' ? setMode('results') : openFilters())}
              className={cn(
                'relative shrink-0 rounded-md p-1.5 hover:bg-accent',
                mode === 'filters' || appliedCount > 0 ? 'text-primary' : 'text-foreground-3',
              )}
              aria-label="Filters"
            >
              <Filter className="size-4" />
              {appliedCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] leading-4 text-center">
                  {appliedCount}
                </span>
              )}
            </button>
          </div>

          {mode === 'results' && (
            <div className="flex gap-1 px-3 py-2 border-b border-border overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-md whitespace-nowrap',
                    activeTab === tab.value
                      ? 'bg-accent-soft text-primary'
                      : 'text-foreground-3 hover:text-foreground-2 hover:bg-accent/50',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {mode === 'filters' ? (
            <FilterPanel
              scope={activeTab}
              onScopeChange={setActiveTab}
              staged={staged}
              onChange={setStaged}
              onApply={applyFilters}
            />
          ) : showRecents ? (
            <div className="px-3 py-3 max-h-[420px] overflow-y-auto">
              {recentSearches.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2.5 py-11 text-center">
                  <Search className="size-6 text-foreground-3" />
                  <p className="text-sm font-medium text-foreground-3">Find anything in Lynq</p>
                </div>
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

        {/* Keyboard navigation hints (Figma 329-791) */}
        <div className="flex items-center gap-4 border-t border-border bg-background px-[18px] py-3">
          <span className="flex items-center gap-1.5 text-sm text-foreground-3">
            <kbd className="rounded-[5px] border border-border bg-card px-1.5 py-0.5 text-[11px] text-foreground-3">↑</kbd>
            <kbd className="rounded-[5px] border border-border bg-card px-1.5 py-0.5 text-[11px] text-foreground-3">↓</kbd>
            to navigate
          </span>
          <span className="flex items-center gap-1.5 text-sm text-foreground-3">
            <kbd className="rounded-[5px] border border-border bg-card px-1.5 py-0.5 text-[11px] text-foreground-3">↵</kbd>
            to select
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
