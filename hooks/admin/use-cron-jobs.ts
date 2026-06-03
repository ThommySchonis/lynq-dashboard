'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { parseJson } from '@/lib/utils/typed-json'
import { adminKeys } from './use-admin-data'
import { apiUrl } from '@/lib/api-client'
import type { CronJobRun } from '@/types/admin'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const cronKeys = {
  all: [...adminKeys.all, 'cron-jobs'] as const,
  list: (filters: Record<string, string>) =>
    [...cronKeys.all, 'list', filters] as const,
  latest: () => [...cronKeys.all, 'latest'] as const,
}

interface CronRunsResponse {
  runs: CronJobRun[]
}

export function useCronRunsLatest() {
  const token = useToken()
  return useQuery<CronJobRun[]>({
    queryKey: cronKeys.latest(),
    queryFn: async () => {
      const res = await fetch(apiUrl('admin/cron-runs/latest'), {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch latest cron runs')
      const data = await parseJson<CronRunsResponse>(res)
      return data.runs
    },
    enabled: !!token,
    staleTime: 30_000,
  })
}

export function useCronRuns(filters: {
  jobName?: string
  status?: string
  from?: string
  to?: string
  limit?: number
}) {
  const token = useToken()
  const params = new URLSearchParams()
  if (filters.jobName) params.set('jobName', filters.jobName)
  if (filters.status) params.set('status', filters.status)
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.limit) params.set('limit', String(filters.limit))

  return useQuery<CronJobRun[]>({
    queryKey: cronKeys.list(Object.fromEntries(params)),
    queryFn: async () => {
      const res = await fetch(`${apiUrl('admin/cron-runs')}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch cron runs')
      const data = await parseJson<CronRunsResponse>(res)
      return data.runs
    },
    enabled: !!token,
    staleTime: 30_000,
  })
}

export function useCronRunsRealtime() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('cron-job-runs-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cron_job_runs' },
        () => {
          void queryClient.invalidateQueries({ queryKey: cronKeys.all })
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient])
}
