'use client'

import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query'
import { useState } from 'react'
import { useServiceHealthStore } from '@/stores/service-health'
import { ServiceFetchError } from '@/lib/service-fetch'

function handleServiceError(error: unknown) {
  if (error instanceof ServiceFetchError) {
    const store = useServiceHealthStore.getState()
    const { service, isTransient } = error.data
    store.setStatus(service, isTransient ? 'degraded' : 'down')
  }
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: handleServiceError,
        }),
        mutationCache: new MutationCache({
          onError: handleServiceError,
        }),
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
