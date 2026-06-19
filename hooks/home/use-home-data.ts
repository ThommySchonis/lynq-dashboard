'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { rpc } from '@/lib/rpc'
import { parseJson } from '@/lib/utils/typed-json'
import { useStoreStore } from '@/stores/store'
import { apiUrl } from '@/lib/api-client'

export interface ShopifyContext {
  kpis: Record<string, unknown>
  orders: Record<string, unknown>[]
  refunds: Record<string, unknown>[]
}

export interface OnboardingStatus {
  /** 'trial' | 'active' | 'past_due' | 'canceled' | 'paused' */
  subscription_status: string
  trial_ends_at: string | null
  is_payment_exempt?: boolean
  is_platform_admin?: boolean
  /** Checklist signals (returned by api_get_onboarding_status). */
  email_connected?: boolean
  shopify_connected?: boolean
  macros_count?: number
  team_member_count?: number
  user?: {
    first_name?: string
    welcome_dismissed_at?: string | null
  }
}

interface OrdersResponse {
  orders?: Record<string, unknown>[]
}

interface RefundsResponse {
  refunds?: Record<string, unknown>[]
}

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const homeKeys = {
  all: ['home'] as const,
  kpis: (storeId: string | null) => [...homeKeys.all, 'kpis', storeId] as const,
  onboarding: () => [...homeKeys.all, 'onboarding'] as const,
}

export function useHomeKpis() {
  const token = useToken()
  const activeStoreId = useStoreStore((s) => s.activeStoreId)

  return useQuery<ShopifyContext>({
    queryKey: homeKeys.kpis(activeStoreId),
    queryFn: async () => {
      const headers = { Authorization: `Bearer ${token}` }
      const storeParam = activeStoreId ? `?store_id=${activeStoreId}` : ''
      const [kpisRes, ordersRes, refundsRes] = await Promise.all([
        fetch(`${apiUrl('shopify/kpis')}${storeParam}`, { headers }),
        fetch(`${apiUrl('shopify/orders')}${storeParam}`, { headers }),
        fetch(`${apiUrl('shopify/refunds')}${storeParam}`, { headers }),
      ])

      const kpis = kpisRes.ok ? await parseJson<Record<string, unknown>>(kpisRes) : {}
      const ordersBody = ordersRes.ok ? await parseJson<OrdersResponse>(ordersRes) : {}
      const refundsBody = refundsRes.ok ? await parseJson<RefundsResponse>(refundsRes) : {}
      const orders = ordersBody.orders ?? []
      const refunds = refundsBody.refunds ?? []

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
      try {
        return await rpc<OnboardingStatus>('api_get_onboarding_status')
      } catch {
        return null
      }
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  })
}
