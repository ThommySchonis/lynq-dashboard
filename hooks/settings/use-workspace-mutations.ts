'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsKeys } from './use-settings-data'
import { useToken } from './utils'
import { toast } from 'sonner'
import { parseJson } from '@/lib/utils/typed-json'
import { rpc } from '@/lib/rpc'
import { apiUrl } from '@/lib/api-client'

interface ErrorResponse {
  error?: string
}

interface LogoUploadResponse {
  logo_url: string
}

export function useUpdateWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      return rpc('api_update_workspace', {
        p_name: body.name ?? null,
        p_slug: body.slug ?? null,
        p_logo_url: body.logo_url ?? null,
        p_timezone: body.timezone ?? null,
        p_locale: body.locale ?? null,
        p_date_format: body.date_format ?? null,
        p_time_format: body.time_format ?? null,
        p_first_day_of_week: body.first_day_of_week ?? null,
        p_show_order_data: body.show_order_data ?? null,
        p_auto_translate: body.auto_translate ?? null,
        p_allow_deletion: body.allow_deletion ?? null,
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsKeys.workspace() })
      toast.success('Workspace updated')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useUploadLogo() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(apiUrl('workspaces/logo'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (!res.ok) {
        const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(d.error ||'Logo upload failed')
      }
      return parseJson<LogoUploadResponse>(res)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsKeys.workspace() })
      toast.success('Logo uploaded')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useDeleteLogo() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl('workspaces/logo'), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(d.error ||'Failed to remove logo')
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsKeys.workspace() })
      toast.success('Logo removed')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useDeleteWorkspace() {
  const token = useToken()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl('workspaces/current/delete'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await parseJson<{ error: string }>(res)
        throw new Error(data.error)
      }
      return parseJson<{ scheduledFor: string }>(res)
    },
    onSuccess: () => {
      toast.success('Workspace deletion scheduled')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
