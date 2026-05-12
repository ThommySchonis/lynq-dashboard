'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { billingKeys } from './use-billing-data'
import { useToken } from './utils'
import type { UpdateBillingInfoInput } from '@/types/billing'

async function mutate(url: string, method: string, token: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    throw new Error((d as { error?: string }).error || `Request failed: ${url}`)
  }
  return res.json()
}

// ─── Plan management ─────────────────────────────────────────────────

export function useChangePlan() {
  const token = useToken()
  const qc    = useQueryClient()
  return useMutation({
    mutationFn: (planId: string) => mutate('/api/billing/subscription/change-plan', 'POST', token, { plan_id: planId }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: billingKeys.subscription() })
      qc.invalidateQueries({ queryKey: billingKeys.usage() })
      toast.success('Plan updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useCancelSubscription() {
  const token = useToken()
  const qc    = useQueryClient()
  return useMutation({
    mutationFn: () => mutate('/api/billing/subscription/cancel', 'POST', token),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: billingKeys.subscription() })
      toast.success('Subscription will cancel at the end of the period')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useReactivateSubscription() {
  const token = useToken()
  const qc    = useQueryClient()
  return useMutation({
    mutationFn: () => mutate('/api/billing/subscription/reactivate', 'POST', token),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: billingKeys.subscription() })
      toast.success('Subscription reactivated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── Billing info ────────────────────────────────────────────────────

export function useUpdateBillingInfo() {
  const token = useToken()
  const qc    = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateBillingInfoInput) => mutate('/api/billing/info', 'PATCH', token, input),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: billingKeys.billingInfo() })
      toast.success('Billing information updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── Payment methods ─────────────────────────────────────────────────

export function useDeletePaymentMethod() {
  const token = useToken()
  const qc    = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => mutate(`/api/billing/payment-methods/${id}`, 'DELETE', token),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: billingKeys.paymentMethods() })
      toast.success('Payment method removed')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── Addons ──────────────────────────────────────────────────────────

export function useSubscribeAddon() {
  const token = useToken()
  const qc    = useQueryClient()
  return useMutation({
    mutationFn: (addonId: string) => mutate(`/api/billing/addons/${addonId}/subscribe`, 'POST', token),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: billingKeys.addons() })
      toast.success('Add-on activated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
