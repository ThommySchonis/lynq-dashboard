'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { billingKeys } from './use-billing-data'
import { useToken } from './utils'
import { parseJson } from '@/lib/utils/typed-json'
import type { UpdateBillingInfoInput } from '@/types/billing'

interface ErrorResponse {
  error?: string
}

async function mutate(url: string, method: string, token: string, body?: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
    throw new Error(d.error || `Request failed: ${url}`)
  }
  return parseJson<unknown>(res)
}

// ─── Plan management ─────────────────────────────────────────────────

/**
 * Change-plan response is discriminated by `mode`:
 *   - 'updated'  → Whop membership PATCHed in place; refresh data + toast
 *   - 'checkout' → redirect the browser to Whop-hosted checkout URL
 *                  to complete payment. The membership.activated
 *                  webhook updates our DB on success.
 */
interface ChangePlanUpdatedResponse {
  ok:           true
  mode:         'updated'
  subscription: unknown
}
interface ChangePlanCheckoutResponse {
  ok:           true
  mode:         'checkout'
  checkout_url: string
}
type ChangePlanResponse = ChangePlanUpdatedResponse | ChangePlanCheckoutResponse

interface ChangePlanVariables {
  planId:       string
  openInNewTab?: boolean
}

export function useChangePlan() {
  const token = useToken()
  const qc    = useQueryClient()
  return useMutation<ChangePlanResponse, Error, ChangePlanVariables>({
    mutationFn: async ({ planId }) => {
      // Pass success_url so Whop redirects back to the billing tab
      // after the user pays. We use the current origin so it works in
      // preview deploys too.
      const successUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/settings/workspace/billing?tab=usage&checkout=success`
        : undefined
      return await mutate('/api/billing/subscription/change-plan', 'POST', token, {
        plan_id:     planId,
        success_url: successUrl,
      }) as ChangePlanResponse
    },
    onSuccess: (data, vars) => {
      if (data.mode === 'checkout') {
        // Open Whop's hosted checkout. The user comes back to
        // success_url after paying; the webhook handles DB state.
        // openInNewTab keeps the dashboard tab alive so React Query
        // cache is preserved when the checkout window is closed.
        if (typeof window !== 'undefined') {
          if (vars.openInNewTab) {
            window.open(data.checkout_url, '_blank', 'noopener,noreferrer')
          } else {
            window.location.href = data.checkout_url
          }
        }
        return
      }
      // mode === 'updated' → in-place plan change succeeded
      void qc.invalidateQueries({ queryKey: billingKeys.subscription() })
      void qc.invalidateQueries({ queryKey: billingKeys.usage() })
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
      void qc.invalidateQueries({ queryKey: billingKeys.subscription() })
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
      void qc.invalidateQueries({ queryKey: billingKeys.subscription() })
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
      void qc.invalidateQueries({ queryKey: billingKeys.billingInfo() })
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
      void qc.invalidateQueries({ queryKey: billingKeys.paymentMethods() })
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
      void qc.invalidateQueries({ queryKey: billingKeys.addons() })
      toast.success('Add-on activated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
