'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsKeys } from './use-settings-data'
import { useToken } from './utils'
import { toast } from 'sonner'
import { parseJson } from '@/lib/utils/typed-json'
import type { CustomEmailConfig } from '@/types/settings'

interface ErrorResponse {
  error?: string
}

interface ShopifyOAuthResponse {
  url: string
}

/* ─────────────────────────────────────────────
   Email mutations
───────────────────────────────────────────── */

export function useConnectCustomEmail() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (config: CustomEmailConfig) => {
      const res = await fetch('/api/auth/custom-email/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(config),
      })
      if (!res.ok) {
        const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(d.error || 'Failed to connect email')
      }
      return parseJson<unknown>(res)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsKeys.emailAccounts() })
      toast.success('Email account connected')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useDisconnectEmail() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/inbox/accounts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(d.error || 'Failed to disconnect email')
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsKeys.emailAccounts() })
      toast.success('Email account disconnected')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

/* ─────────────────────────────────────────────
   Shopify mutations
───────────────────────────────────────────── */

export function useConnectShopify() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ domain, access_token }: { domain: string; access_token: string }) => {
      const res = await fetch('/api/shopify/manual-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ shop: domain, accessToken: access_token }),
      })
      if (!res.ok) {
        const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(d.error || 'Failed to connect Shopify')
      }
      return parseJson<unknown>(res)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...settingsKeys.all, 'shopify'] })
      toast.success('Shopify connected')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useDisconnectShopify() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/shopify/manual-connect', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(d.error || 'Failed to disconnect Shopify')
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...settingsKeys.all, 'shopify'] })
      toast.success('Shopify disconnected')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

/* ─────────────────────────────────────────────
   Shopify OAuth
───────────────────────────────────────────── */

export async function startShopifyOAuth(token: string, shop: string): Promise<string> {
  const res = await fetch('/api/auth/shopify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ shop }),
  })
  if (!res.ok) {
    const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
    throw new Error(d.error || 'Failed to start Shopify OAuth')
  }
  const data = await parseJson<ShopifyOAuthResponse>(res)
  return data.url
}
