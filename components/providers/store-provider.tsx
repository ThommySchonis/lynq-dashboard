'use client'

import { useEffect } from 'react'
import { useStores } from '@/hooks/stores'
import { useStoreStore } from '@/stores/store'
import { useAuthStore } from '@/stores/auth'

/**
 * Side-effect component: fetches stores via TanStack and syncs to Zustand.
 * Renders nothing — place as a sibling in the provider tree (same pattern as AuthHydrator).
 */
export function StoreProvider() {
  const session = useAuthStore((s) => s.session)
  const { data: stores, isLoading } = useStores()
  const setStores = useStoreStore((s) => s.setStores)
  const setLoading = useStoreStore((s) => s.setLoading)
  const clearStores = useStoreStore((s) => s.clearStores)

  useEffect(() => {
    if (!session) {
      clearStores()
      return
    }
    if (isLoading) {
      setLoading(true)
      return
    }
    if (stores) {
      setStores(stores)
    }
  }, [session, stores, isLoading, setStores, setLoading, clearStores])

  return null
}
