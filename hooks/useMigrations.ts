'use client'

// hooks/useMigrations.ts

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiUrl } from '@/lib/api-client'
import { supabase } from '@/lib/supabase'
import type { Migration, SourceMailbox, SourcePlatform } from '@/types/migrations'

async function authedFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function useMigrations() {
  return useQuery<{ migrations: Migration[] }>({
    queryKey: ['migrations'],
    queryFn: () => authedFetch<{ migrations: Migration[] }>('migrations'),
  })
}

export function useMigration(id: string | null, opts?: { pollMs?: number }) {
  return useQuery<{ migration: Migration }>({
    queryKey: ['migrations', id],
    queryFn: () => authedFetch<{ migration: Migration }>(`migrations/${id}`),
    enabled: !!id,
    refetchInterval: opts?.pollMs,
  })
}

export function useCreateMigration() {
  const qc = useQueryClient()
  return useMutation<{ id: string }, Error, { source_platform: SourcePlatform; source_subdomain?: string }>({
    mutationFn: (body) => authedFetch<{ id: string }>('migrations', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['migrations'] }) },
  })
}

export function useAuthenticateMigration(id: string) {
  return useMutation<{ mailboxes: SourceMailbox[] }, Error, {
    auth_method: 'oauth' | 'api_key'
    subdomain?: string
    access_token?: string
    api_key?: string
    username?: string
  }>({
    mutationFn: (body) => authedFetch<{ mailboxes: SourceMailbox[] }>(`migrations/${id}/auth`, { method: 'POST', body: JSON.stringify(body) }),
  })
}

export function useSetMailboxLinks(id: string) {
  return useMutation<{ success: true }, Error, { mailbox_links: Record<string, string> }>({
    mutationFn: (body) => authedFetch<{ success: true }>(`migrations/${id}/mailbox-links`, { method: 'POST', body: JSON.stringify(body) }),
  })
}

export function useStartMigration(id: string) {
  const qc = useQueryClient()
  return useMutation<{ success: true }, Error, { time_range_start: string; time_range_end: string }>({
    mutationFn: (body) => authedFetch<{ success: true }>(`migrations/${id}/start`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['migrations'] }) },
  })
}

export function useRetryMigration() {
  const qc = useQueryClient()
  return useMutation<{ success: true }, Error, string>({
    mutationFn: (id) => authedFetch<{ success: true }>(`migrations/${id}/retry`, { method: 'POST' }),
    onSuccess: (_, id) => {
      void qc.invalidateQueries({ queryKey: ['migrations'] })
      void qc.invalidateQueries({ queryKey: ['migrations', id] })
    },
  })
}

export function useCancelMigration() {
  const qc = useQueryClient()
  return useMutation<{ success: true }, Error, string>({
    mutationFn: (id) => authedFetch<{ success: true }>(`migrations/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['migrations'] }) },
  })
}
