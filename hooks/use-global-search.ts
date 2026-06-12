'use client'

import { useQuery } from '@tanstack/react-query'
import { apiUrl } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth'

const QUERY_MIN_LENGTH = 2
const STALE_TIME_MS = 30_000

export type SearchTab =
  | 'all'
  | 'conversations'
  | 'messages'
  | 'contacts'
  | 'shopify'

export interface ConversationResult {
  id: string
  subject: string | null
  snippet: string | null
  customer_email: string | null
  customer_name: string | null
  last_message_at: string | null
  status: string | null
}

export interface MessageResult {
  id: string
  conversation_id: string
  snippet: string
  from_email: string | null
  from_name: string | null
  is_outbound: boolean
  created_at: string | null
}

export interface ContactResult {
  email: string
  name: string | null
  last_message_at: string | null
  conversation_count: number
}

export interface ShopifyCustomerResult {
  id: string
  email: string | null
  name: string
  ordersCount: number | null
  totalSpent: string | null
}

interface SupabaseSearchResponse {
  conversations?: ConversationResult[]
  messages?: MessageResult[]
  contacts?: ContactResult[]
}

interface ShopifyCustomerSearchResponse {
  customers: ShopifyCustomerResult[]
}

function supabaseTypesForTab(tab: SearchTab): string[] | null {
  if (tab === 'all') return ['conversations', 'messages', 'contacts']
  if (tab === 'shopify') return null
  return [tab]
}

function fetchJson<T>(url: string, token: string): Promise<T> {
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((res) => {
    if (!res.ok) throw new Error(`Request failed: ${res.status}`)
    return res.json() as Promise<T>
  })
}

export function useGlobalSearch(q: string, tab: SearchTab) {
  const token = useAuthStore((s) => s.session?.access_token ?? '')
  const enabled = q.length >= QUERY_MIN_LENGTH && token.length > 0

  const supabaseTypes = supabaseTypesForTab(tab)
  const wantsSupabase = enabled && supabaseTypes !== null
  const wantsShopify = enabled && (tab === 'all' || tab === 'shopify')

  const supabaseQuery = useQuery({
    queryKey: ['search', q, supabaseTypes?.join(',') ?? ''],
    queryFn: () => {
      const params = new URLSearchParams({ q })
      if (supabaseTypes) params.set('types', supabaseTypes.join(','))
      return fetchJson<SupabaseSearchResponse>(apiUrl(`search?${params.toString()}`), token)
    },
    enabled: wantsSupabase,
    staleTime: STALE_TIME_MS,
  })

  const shopifyQuery = useQuery({
    queryKey: ['search-shopify', q],
    queryFn: () => {
      const params = new URLSearchParams({ q })
      return fetchJson<ShopifyCustomerSearchResponse>(
        apiUrl(`inbox/shopify-customer?${params.toString()}`),
        token,
      )
    },
    enabled: wantsShopify,
    staleTime: STALE_TIME_MS,
  })

  return {
    conversations: supabaseQuery.data?.conversations ?? [],
    messages: supabaseQuery.data?.messages ?? [],
    contacts: supabaseQuery.data?.contacts ?? [],
    shopifyCustomers: shopifyQuery.data?.customers ?? [],
    isLoading: (wantsSupabase && supabaseQuery.isLoading) || (wantsShopify && shopifyQuery.isLoading),
    supabaseError: supabaseQuery.error ?? null,
    shopifyError: shopifyQuery.error ?? null,
    hasAnyResult:
      (supabaseQuery.data?.conversations?.length ?? 0) +
        (supabaseQuery.data?.messages?.length ?? 0) +
        (supabaseQuery.data?.contacts?.length ?? 0) +
        (shopifyQuery.data?.customers?.length ?? 0) >
      0,
  }
}
