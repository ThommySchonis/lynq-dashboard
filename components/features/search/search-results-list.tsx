'use client'

import { CommandEmpty, CommandGroup, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command'
import { Mail, MessageSquare, User, ShoppingBag } from 'lucide-react'
import type {
  ConversationResult,
  ContactResult,
  MessageResult,
  SearchTab,
  ShopifyCustomerResult,
} from '@/hooks/use-global-search'

type ResultSelection =
  | { kind: 'conversation'; result: ConversationResult }
  | { kind: 'message';      result: MessageResult }
  | { kind: 'contact';      result: ContactResult }
  | { kind: 'shopify';      result: ShopifyCustomerResult }

interface Props {
  query: string
  activeTab: SearchTab
  conversations: ConversationResult[]
  messages: MessageResult[]
  contacts: ContactResult[]
  shopifyCustomers: ShopifyCustomerResult[]
  supabaseError: unknown
  shopifyError: unknown
  isLoading: boolean
  hasAnyResult: boolean
  onSelect: (selection: ResultSelection) => void
  onSeeAll: (tab: Exclude<SearchTab, 'all'>) => void
}

const ALL_LIMIT = 5

export function SearchResultsList({
  query,
  activeTab,
  conversations,
  messages,
  contacts,
  shopifyCustomers,
  supabaseError,
  shopifyError,
  isLoading,
  hasAnyResult,
  onSelect,
  onSeeAll,
}: Props) {
  const showSupabaseError = supabaseError !== null && (activeTab !== 'shopify')
  const showShopifyError = shopifyError !== null && (activeTab === 'all' || activeTab === 'shopify')

  return (
    <CommandList className="max-h-[420px]">
      {isLoading && !hasAnyResult && (
        <div className="px-4 py-6 text-center text-sm text-foreground-3">Searching…</div>
      )}

      {!isLoading && !hasAnyResult && !showSupabaseError && !showShopifyError && (
        <CommandEmpty>No results for &ldquo;{query}&rdquo;</CommandEmpty>
      )}

      {(activeTab === 'all' || activeTab === 'conversations') && conversations.length > 0 && (
        <CommandGroup
          heading={renderHeading('Conversations', activeTab === 'all', () => onSeeAll('conversations'))}
        >
          {(activeTab === 'all' ? conversations.slice(0, ALL_LIMIT) : conversations).map((c) => (
            <CommandItem
              key={`conv-${c.id}`}
              value={`conv-${c.id}`}
              onSelect={() => onSelect({ kind: 'conversation', result: c })}
            >
              <Mail size={14} className="shrink-0 text-foreground-4" />
              <div className="flex flex-col min-w-0">
                <span className="truncate text-sm">
                  {c.subject || c.customer_name || c.customer_email || 'Untitled conversation'}
                </span>
                <span className="truncate text-xs text-foreground-3">
                  {[c.customer_name, c.customer_email].filter(Boolean).join(' · ') || c.snippet || ''}
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      )}

      {activeTab === 'all' && conversations.length > 0 && messages.length > 0 && <CommandSeparator />}

      {(activeTab === 'all' || activeTab === 'messages') && messages.length > 0 && (
        <CommandGroup
          heading={renderHeading('Messages', activeTab === 'all', () => onSeeAll('messages'))}
        >
          {(activeTab === 'all' ? messages.slice(0, ALL_LIMIT) : messages).map((m) => (
            <CommandItem
              key={`msg-${m.id}`}
              value={`msg-${m.id}`}
              onSelect={() => onSelect({ kind: 'message', result: m })}
            >
              <MessageSquare size={14} className="shrink-0 text-foreground-4" />
              <div className="flex flex-col min-w-0">
                <span className="truncate text-sm">
                  {(m.from_name || m.from_email || 'Unknown sender') + (m.is_outbound ? ' (outbound)' : '')}
                </span>
                <span className="truncate text-xs text-foreground-3">{m.snippet}</span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      )}

      {activeTab === 'all' && messages.length > 0 && contacts.length > 0 && <CommandSeparator />}

      {(activeTab === 'all' || activeTab === 'contacts') && contacts.length > 0 && (
        <CommandGroup
          heading={renderHeading('Contacts', activeTab === 'all', () => onSeeAll('contacts'))}
        >
          {(activeTab === 'all' ? contacts.slice(0, ALL_LIMIT) : contacts).map((c) => (
            <CommandItem
              key={`contact-${c.email}`}
              value={`contact-${c.email}`}
              onSelect={() => onSelect({ kind: 'contact', result: c })}
            >
              <User size={14} className="shrink-0 text-foreground-4" />
              <div className="flex flex-col min-w-0">
                <span className="truncate text-sm">{c.name || c.email}</span>
                <span className="truncate text-xs text-foreground-3">
                  {c.email} · {c.conversation_count} conversation{c.conversation_count === 1 ? '' : 's'}
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      )}

      {activeTab === 'all' && contacts.length > 0 && shopifyCustomers.length > 0 && <CommandSeparator />}

      {(activeTab === 'all' || activeTab === 'shopify') && shopifyCustomers.length > 0 && (
        <CommandGroup
          heading={renderHeading('Shopify customers', activeTab === 'all', () => onSeeAll('shopify'))}
        >
          {(activeTab === 'all' ? shopifyCustomers.slice(0, ALL_LIMIT) : shopifyCustomers).map((s) => (
            <CommandItem
              key={`shopify-${s.id}`}
              value={`shopify-${s.id}`}
              onSelect={() => onSelect({ kind: 'shopify', result: s })}
            >
              <ShoppingBag size={14} className="shrink-0 text-foreground-4" />
              <div className="flex flex-col min-w-0">
                <span className="truncate text-sm">{s.name || s.email || `Customer ${s.id}`}</span>
                <span className="truncate text-xs text-foreground-3">
                  {[s.email, s.ordersCount != null ? `${s.ordersCount} order${s.ordersCount === 1 ? '' : 's'}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      )}

      {showSupabaseError && (
        <div className="px-4 py-2 text-xs text-destructive">
          Couldn&rsquo;t load conversations / messages / contacts. Try again.
        </div>
      )}
      {showShopifyError && (
        <div className="px-4 py-2 text-xs text-destructive">
          Couldn&rsquo;t load Shopify customers. Try again.
        </div>
      )}
    </CommandList>
  )
}

function renderHeading(label: string, showSeeAll: boolean, onSeeAll: () => void) {
  if (!showSeeAll) return label
  return (
    <span className="flex items-center justify-between w-full">
      <span>{label}</span>
      <button
        type="button"
        onClick={onSeeAll}
        className="text-xs text-foreground-3 hover:text-foreground-2"
      >
        See all →
      </button>
    </span>
  )
}
