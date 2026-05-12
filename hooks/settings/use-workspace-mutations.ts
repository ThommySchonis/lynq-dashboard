'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsKeys } from './use-settings-data'
import { useToken } from './utils'
import { toast } from 'sonner'

export function useUpdateWorkspace() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch('/api/workspaces/current', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Failed to update workspace')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.workspace() })
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
      const res = await fetch('/api/workspaces/current/logo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Logo upload failed')
      }
      return res.json() as Promise<{ logo_url: string }>
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.workspace() })
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
      const res = await fetch('/api/workspaces/current/logo', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Failed to remove logo')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.workspace() })
      toast.success('Logo removed')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}
