"use client";

import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { useState } from "react";
import { useServiceHealthStore } from "@/stores/service-health";
import { ServiceFetchError } from "@/lib/service-fetch";
import { isAuthError, recoverAuth } from "@/lib/auth-recovery";

function handleServiceError(error: unknown) {
  if (error instanceof ServiceFetchError) {
    const store = useServiceHealthStore.getState();
    const { service, isTransient } = error.data;
    store.setStatus(service, isTransient ? "degraded" : "down");
  }
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    // Holder so the cache's onError can invalidate the client that owns it.
    const ref: { client?: QueryClient } = {};

    // Any 401 means the cached session is no longer valid. Try to refresh it
    // once; on success, refetch everything so the UI heals instead of looping
    // on the failed queries (e.g. the plan-badge subscription white screen).
    // On failure recoverAuth() clears the store and AuthGuard redirects to /login.
    const onError = (error: unknown) => {
      handleServiceError(error);
      if (isAuthError(error)) {
        void recoverAuth().then((recovered) => {
          if (recovered) void ref.client?.invalidateQueries();
        });
      }
    };

    ref.client = new QueryClient({
      queryCache: new QueryCache({ onError }),
      mutationCache: new MutationCache({ onError }),
      defaultOptions: {
        queries: {
          staleTime: 30 * 1000,
          retry: 1,
          refetchOnWindowFocus: false,
        },
      },
    });
    return ref.client;
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
