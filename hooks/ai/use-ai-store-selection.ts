'use client'

import { useCallback, useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useStores } from '@/hooks/stores'

type Stores = ReturnType<typeof useStores>['data']

interface UseAiStoreSelectionResult {
  storeId: string
  setStore: (id: string) => void
  stores: Stores
  storesLoading: boolean
}

/**
 * Reads/writes the selected store from the `?store=` query param.
 * Defaults to the first store when none is selected. Shared by the
 * three AI agent settings pages so the selection logic stays in one place.
 */
export function useAiStoreSelection(): UseAiStoreSelectionResult {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const { data: stores, isLoading: storesLoading } = useStores()
  const storeId = searchParams.get('store') ?? ''

  const setStore = useCallback(
    (id: string) => {
      const sp = new URLSearchParams(searchParams.toString())
      sp.set('store', id)
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  useEffect(() => {
    if (!storeId && stores && stores.length > 0) {
      setStore(stores[0].id)
    }
  }, [storeId, stores, setStore])

  return { storeId, setStore, stores, storesLoading }
}
