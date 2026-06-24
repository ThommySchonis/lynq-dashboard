'use client'

import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useToken } from './utils'
import { parseJson } from '@/lib/utils/typed-json'
import { apiUrl } from '@/lib/api-client'
import type {
  Invoice,
  ManageUrlResponse,
  SubscriptionWithUsageResponse,
} from '@/types/billing'

interface ErrorResponse {
  error?: string
}

export const billingKeys = {
  all:            ['billing'] as const,
  subscription:   () => [...billingKeys.all, 'subscription'] as const,
  invoices:       () => [...billingKeys.all, 'invoices'] as const,
  manageUrl:      () => [...billingKeys.all, 'manage-url'] as const,
}

async function jsonFetch<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
    throw new Error(d.error || `Request failed: ${url}`)
  }
  return parseJson<T>(res)
}

export function useSubscription() {
  const token = useToken()
  return useQuery<SubscriptionWithUsageResponse>({
    queryKey: billingKeys.subscription(),
    queryFn:  () => jsonFetch<SubscriptionWithUsageResponse>(apiUrl('billing/subscription'), token),
    enabled:  !!token,
    staleTime: 60_000,
  })
}

export function useManageUrl() {
  const token = useToken()
  return useQuery<string | null>({
    queryKey: billingKeys.manageUrl(),
    queryFn: async () => {
      const res = await fetch(apiUrl('billing/manage-url'), {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return null
      const data = await parseJson<ManageUrlResponse>(res).catch(() => null)
      return data?.url ?? null
    },
    enabled:  !!token,
    staleTime: 5 * 60_000,
  })
}

/**
 * Opens the Shopify managed-pricing page in a new tab. Billing is managed by
 * Shopify, so every mutating billing action (change plan, update payment,
 * cancel) routes here. `ready` is false until the URL has loaded.
 */
export function useOpenManageUrl() {
  const { data: manageUrl } = useManageUrl()
  const openManage = useCallback(() => {
    if (manageUrl) window.open(manageUrl, '_blank', 'noopener,noreferrer')
  }, [manageUrl])
  return { openManage, ready: !!manageUrl }
}

export function useInvoices() {
  const token = useToken()
  return useQuery<Invoice[]>({
    queryKey: billingKeys.invoices(),
    queryFn: async () => {
      const data = await jsonFetch<{ invoices: Invoice[] }>(apiUrl('billing/invoices'), token)
      return data.invoices ?? []
    },
    enabled:  !!token,
    staleTime: 60_000,
  })
}
