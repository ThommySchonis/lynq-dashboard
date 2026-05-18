'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { parseJson } from '@/lib/utils/typed-json'
import type { DateRange, KpiData, PrevKpiData, Refund, RevenueTrendPoint, AiInsight } from '@/types/analytics'

interface RefundsResponse {
  refunds?: Refund[]
}

interface RevenueTrendResponse {
  trend?: RevenueTrendPoint[]
}

interface AiInsightsResponse {
  insights?: AiInsight[]
}

interface ShopifyConnectedResponse {
  shopify?: unknown
}

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const analyticsKeys = {
  all: ['analytics'] as const,
  kpis: (range: DateRange) => [...analyticsKeys.all, 'kpis', range.from, range.to] as const,
  prevKpis: (range: DateRange) => [...analyticsKeys.all, 'prevKpis', range.from, range.to] as const,
  refunds: (range: DateRange) => [...analyticsKeys.all, 'refunds', range.from, range.to] as const,
  allRefunds: () => [...analyticsKeys.all, 'allRefunds'] as const,
  revenueTrend: (range: DateRange) => [...analyticsKeys.all, 'revenueTrend', range.from, range.to] as const,
  aiInsights: () => [...analyticsKeys.all, 'aiInsights'] as const,
  shopifyConnected: () => [...analyticsKeys.all, 'shopifyConnected'] as const,
}

export function useKpis(range: DateRange) {
  const token = useToken()
  return useQuery<KpiData>({
    queryKey: analyticsKeys.kpis(range),
    queryFn: async () => {
      const res = await fetch(`/api/shopify/kpis?from=${range.from}&to=${range.to}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch KPIs')
      return parseJson<KpiData>(res)
    },
    enabled: !!token,
  })
}

export function usePrevKpis(range: DateRange) {
  const token = useToken()
  return useQuery<PrevKpiData>({
    queryKey: analyticsKeys.prevKpis(range),
    queryFn: async () => {
      const res = await fetch(`/api/shopify/kpis?from=${range.from}&to=${range.to}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch previous KPIs')
      return parseJson<PrevKpiData>(res)
    },
    enabled: !!token,
  })
}

export function useRefunds(range: DateRange) {
  const token = useToken()
  return useQuery<Refund[]>({
    queryKey: analyticsKeys.refunds(range),
    queryFn: async () => {
      const res = await fetch(`/api/shopify/refunds?from=${range.from}&to=${range.to}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch refunds')
      const d = await parseJson<RefundsResponse>(res)
      return d.refunds ?? []
    },
    enabled: !!token,
  })
}

export function useAllRefunds() {
  const token = useToken()
  return useQuery<Refund[]>({
    queryKey: analyticsKeys.allRefunds(),
    queryFn: async () => {
      const from = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)
      const to = new Date().toISOString().slice(0, 10)
      const res = await fetch(`/api/shopify/refunds?from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch all refunds')
      const d = await parseJson<RefundsResponse>(res)
      return d.refunds ?? []
    },
    enabled: !!token,
  })
}

export function useRevenueTrend(range: DateRange) {
  const token = useToken()
  return useQuery<RevenueTrendPoint[]>({
    queryKey: analyticsKeys.revenueTrend(range),
    queryFn: async () => {
      const res = await fetch(`/api/shopify/revenue-trend?from=${range.from}&to=${range.to}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch revenue trend')
      const d = await parseJson<RevenueTrendResponse>(res)
      return d.trend ?? []
    },
    enabled: !!token,
  })
}

export function useAiInsights(refunds: Refund[]) {
  const token = useToken()
  return useQuery<AiInsight[]>({
    queryKey: analyticsKeys.aiInsights(),
    queryFn: async () => {
      const res = await fetch('/api/analytics/refund-insights', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refunds }),
      })
      if (!res.ok) throw new Error('Failed to fetch AI insights')
      const d = await parseJson<AiInsightsResponse>(res)
      return d.insights ?? []
    },
    enabled: !!token && !!refunds.length,
  })
}

export function useShopifyConnected() {
  const token = useToken()
  return useQuery<boolean>({
    queryKey: analyticsKeys.shopifyConnected(),
    queryFn: async () => {
      const res = await fetch('/api/settings/integrations', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (!res.ok) return false
      const data = await parseJson<ShopifyConnectedResponse>(res)
      return Boolean(data?.shopify)
    },
    enabled: !!token,
  })
}
