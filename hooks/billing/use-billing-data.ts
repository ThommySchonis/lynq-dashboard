'use client'

import { useQuery } from '@tanstack/react-query'
import { useToken } from './utils'
import type {
  SubscriptionResponse,
  UsageResponse,
  Plan,
  Invoice,
  BillingInfo,
  PaymentMethod,
  SubscriptionAddon,
  InvoicesListResponse,
} from '@/types/billing'

export const billingKeys = {
  all:            ['billing'] as const,
  subscription:   () => [...billingKeys.all, 'subscription'] as const,
  usage:          () => [...billingKeys.all, 'usage'] as const,
  plans:          () => [...billingKeys.all, 'plans'] as const,
  invoices:       (page: number) => [...billingKeys.all, 'invoices', page] as const,
  invoice:        (id: string) => [...billingKeys.all, 'invoice', id] as const,
  billingInfo:    () => [...billingKeys.all, 'billing-info'] as const,
  paymentMethods: () => [...billingKeys.all, 'payment-methods'] as const,
  addons:         () => [...billingKeys.all, 'addons'] as const,
}

async function jsonFetch<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    throw new Error((d as { error?: string }).error || `Request failed: ${url}`)
  }
  return res.json() as Promise<T>
}

export function useSubscription() {
  const token = useToken()
  return useQuery<SubscriptionResponse>({
    queryKey: billingKeys.subscription(),
    queryFn:  () => jsonFetch<SubscriptionResponse>('/api/billing/subscription', token),
    enabled:  !!token,
    staleTime: 30_000,
  })
}

export function useUsage() {
  const token = useToken()
  return useQuery<UsageResponse>({
    queryKey: billingKeys.usage(),
    queryFn:  () => jsonFetch<UsageResponse>('/api/billing/usage', token),
    enabled:  !!token,
    staleTime: 30_000,
  })
}

export function usePlans() {
  const token = useToken()
  return useQuery<Plan[]>({
    queryKey: billingKeys.plans(),
    queryFn: async () => {
      const data = await jsonFetch<{ plans: Plan[] }>('/api/billing/plans', token)
      return data.plans ?? []
    },
    enabled:  !!token,
    staleTime: 5 * 60_000,  // plans rarely change
  })
}

export function useInvoices(page = 0, perPage = 25) {
  const token = useToken()
  return useQuery<InvoicesListResponse>({
    queryKey: billingKeys.invoices(page),
    queryFn:  () => jsonFetch<InvoicesListResponse>(`/api/billing/invoices?page=${page}&per_page=${perPage}`, token),
    enabled:  !!token,
  })
}

export function useBillingInfo() {
  const token = useToken()
  return useQuery<BillingInfo | null>({
    queryKey: billingKeys.billingInfo(),
    queryFn: async () => {
      const data = await jsonFetch<{ billing_info: BillingInfo | null }>('/api/billing/info', token)
      return data.billing_info
    },
    enabled:  !!token,
  })
}

export function usePaymentMethods() {
  const token = useToken()
  return useQuery<PaymentMethod[]>({
    queryKey: billingKeys.paymentMethods(),
    queryFn: async () => {
      const data = await jsonFetch<{ payment_methods: PaymentMethod[] }>('/api/billing/payment-methods', token)
      return data.payment_methods ?? []
    },
    enabled:  !!token,
  })
}

export function useAddons() {
  const token = useToken()
  return useQuery<SubscriptionAddon[]>({
    queryKey: billingKeys.addons(),
    queryFn: async () => {
      const data = await jsonFetch<{ addons: SubscriptionAddon[] }>('/api/billing/addons', token)
      return data.addons ?? []
    },
    enabled:  !!token,
    staleTime: 5 * 60_000,
  })
}

export function useInvoice(id: string | null) {
  const token = useToken()
  return useQuery<Invoice | null>({
    queryKey: billingKeys.invoice(id ?? ''),
    queryFn: async () => {
      if (!id) return null
      const data = await jsonFetch<{ invoice: Invoice }>(`/api/billing/invoices/${id}`, token)
      return data.invoice
    },
    enabled:  !!token && !!id,
  })
}
