'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { authFetch } from '@/lib/inbox-utils'
import { parseJson } from '@/lib/utils/typed-json'
import { useAuthStore } from '@/stores/auth'
import { useStoreStore } from '@/stores/store'
import { apiUrl } from '@/lib/api-client'
import type {
  ProductSearchResult,
  ProductSearchVariant,
} from '@/lib/services/shopify'

export type { ProductSearchResult, ProductSearchVariant }

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(handle)
  }, [value, delayMs])
  return debounced
}

/**
 * Debounced live search of Shopify products by title.
 * Returns empty results when the trimmed query is shorter than 2 chars.
 */
export function useProductSearch(rawQuery: string) {
  const token = useAuthStore((s) => s.session?.access_token ?? '')
  const activeStoreId = useStoreStore((s) => s.activeStoreId)
  const debouncedQuery = useDebouncedValue(rawQuery, 250)
  const trimmed = debouncedQuery.trim()
  const enabled = trimmed.length >= 2 && !!token && !!activeStoreId

  return useQuery({
    queryKey: ['shopify-products', trimmed, activeStoreId] as const,
    queryFn: async (): Promise<{ products: ProductSearchResult[] }> => {
      const params = new URLSearchParams({
        q: trimmed,
        store_id: activeStoreId as string,
      })
      const res = await authFetch(
        `${apiUrl('shopify/products')}?${params.toString()}`,
        {},
        token
      )
      if (!res.ok) {
        throw new Error(`Search failed (${res.status})`)
      }
      return parseJson<{ products: ProductSearchResult[] }>(res)
    },
    enabled,
    staleTime: 30_000,
  })
}
