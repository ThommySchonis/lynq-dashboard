'use client'

import { useEffect, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
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

interface ProductsPage {
  products: ProductSearchResult[]
  nextCursor: string | null
  hasNextPage: boolean
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(handle)
  }, [value, delayMs])
  return debounced
}

/**
 * Browse (empty query) or live-search Shopify products by title, with cursor
 * pagination. Empty query is allowed — it browses the whole catalog.
 */
export function useProductSearch(rawQuery: string) {
  const token = useAuthStore((s) => s.session?.access_token ?? '')
  const activeStoreId = useStoreStore((s) => s.activeStoreId)
  const debouncedQuery = useDebouncedValue(rawQuery, 250)
  const trimmed = debouncedQuery.trim()
  const enabled = !!token && !!activeStoreId

  return useInfiniteQuery({
    queryKey: ['shopify-products', trimmed, activeStoreId] as const,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<ProductsPage> => {
      const params = new URLSearchParams({ store_id: activeStoreId as string })
      if (trimmed) params.set('q', trimmed)
      if (pageParam) params.set('cursor', pageParam)
      const res = await authFetch(
        `${apiUrl('shopify/products')}?${params.toString()}`,
        {},
        token,
      )
      if (!res.ok) {
        throw new Error(`Search failed (${res.status})`)
      }
      return parseJson<ProductsPage>(res)
    },
    getNextPageParam: (last) => (last.hasNextPage ? last.nextCursor : undefined),
    enabled,
    staleTime: 30_000,
  })
}
