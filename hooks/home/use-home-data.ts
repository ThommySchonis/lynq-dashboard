'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'

export interface ShopifyContext {
  kpis: Record<string, unknown>
  orders: Record<string, unknown>[]
  refunds: Record<string, unknown>[]
}

export interface OnboardingStatus {
  subscription_status: string
  trial_ends_at: string | null
  user?: {
    first_name?: string
    welcome_dismissed_at?: string | null
  }
}

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const homeKeys = {
  all: ['home'] as const,
  kpis: () => [...homeKeys.all, 'kpis'] as const,
  onboarding: () => [...homeKeys.all, 'onboarding'] as const,
}

export function useHomeKpis() {
  const token = useToken()

  return useQuery<ShopifyContext>({
    queryKey: homeKeys.kpis(),
    queryFn: async () => {
      const headers = { Authorization: `Bearer ${token}` }
      const [kpisRes, ordersRes, refundsRes] = await Promise.all([
        fetch('/api/shopify/kpis', { headers }),
        fetch('/api/shopify/orders', { headers }),
        fetch('/api/shopify/refunds', { headers }),
      ])

      const kpis = kpisRes.ok ? await kpisRes.json() : {}
      const { orders = [] } = ordersRes.ok ? await ordersRes.json() : {}
      const { refunds = [] } = refundsRes.ok ? await refundsRes.json() : {}

      return { kpis, orders, refunds }
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  })
}

export function useOnboardingStatus() {
  const token = useToken()

  return useQuery<OnboardingStatus | null>({
    queryKey: homeKeys.onboarding(),
    queryFn: async () => {
      const res = await fetch('/api/onboarding/status', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (!res.ok) return null
      return res.json()
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  })
}
