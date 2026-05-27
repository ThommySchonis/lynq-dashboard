'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { settingsKeys } from './use-settings-data'
import { useToken } from './utils'
import { toast } from 'sonner'
import { parseJson } from '@/lib/utils/typed-json'
import type { ForwardingConnectResponse, ForwardingStatusResponse, ForwardingVerifyDnsResponse } from '@/types/forwarding'

interface ErrorResponse {
  error?: string
}

export function useConnectForwardingEmail() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (config: { email: string; store_id?: string }) => {
      const res = await fetch('/api/auth/forwarding-email/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(config),
      })
      if (!res.ok) {
        const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(d.error || 'Failed to connect forwarding email')
      }
      return parseJson<ForwardingConnectResponse>(res)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsKeys.emailAccounts() })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useVerifyForwardingDns() {
  const token = useToken()
  return useMutation({
    mutationFn: async (accountId: string) => {
      const res = await fetch('/api/auth/forwarding-email/verify-dns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ account_id: accountId }),
      })
      if (!res.ok) {
        const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(d.error || 'DNS verification failed')
      }
      return parseJson<ForwardingVerifyDnsResponse>(res)
    },
  })
}

export function useVerifyForwarding() {
  const token = useToken()
  return useMutation({
    mutationFn: async (accountId: string) => {
      const res = await fetch('/api/auth/forwarding-email/verify-forwarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ account_id: accountId }),
      })
      if (!res.ok) {
        const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(d.error || 'Failed to send verification email')
      }
      return parseJson<{ sent: boolean }>(res)
    },
    onSuccess: () => {
      toast.success('Verification email sent — check your inbox')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useDisconnectForwardingEmail() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (accountId: string) => {
      const res = await fetch('/api/auth/forwarding-email/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ account_id: accountId }),
      })
      if (!res.ok) {
        const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(d.error || 'Failed to disconnect')
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

export function useForwardingStatus(accountId: string | null) {
  const token = useToken()
  return useQuery<ForwardingStatusResponse>({
    queryKey: [...settingsKeys.all, 'forwarding-status', accountId],
    queryFn: async () => {
      const res = await fetch(`/api/auth/forwarding-email/status?account_id=${accountId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load forwarding status')
      return parseJson<ForwardingStatusResponse>(res)
    },
    enabled: !!token && !!accountId,
    refetchInterval: 10_000,
  })
}
