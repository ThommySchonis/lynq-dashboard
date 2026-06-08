'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToken } from './utils'
import { apiUrl } from '@/lib/api-client'
import { billingKeys } from './use-billing-data'

interface SetBillingStoreResult {
  newBillingStoreDomain: string
  managedPricingUrl: string
}

interface ErrorResponse { error?: string }

async function postJson<T>(url: string, token: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as ErrorResponse
    throw new Error(err.error ?? `${url} failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function useSetBillingStore() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (integrationId: string) =>
      postJson<SetBillingStoreResult>(apiUrl('billing/billing-store'), token, { integration_id: integrationId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: billingKeys.all })
    },
  })
}

export function useSyncBilling() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      postJson<{ subscription: unknown }>(apiUrl('billing/sync'), token, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: billingKeys.all })
    },
  })
}
