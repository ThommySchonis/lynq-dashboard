'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsKeys } from './use-settings-data'
import { useToken } from './utils'
import { toast } from 'sonner'
import type { TagForm } from '@/types/settings'

export function useCreateTag() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (form: TagForm) => {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: form.name, color: form.color }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Failed to create tag')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.tags() })
      toast.success('Tag created')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useUpdateTag() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...form }: TagForm & { id: string }) => {
      const res = await fetch(`/api/tags/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: form.name, color: form.color }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Failed to update tag')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.tags() })
      toast.success('Tag updated')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useDeleteTag() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tags/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Failed to delete tag')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.tags() })
      toast.success('Tag deleted')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useMergeTags() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ winner_id, loser_ids }: { winner_id: string; loser_ids: string[] }) => {
      const res = await fetch('/api/tags/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ winner_id, loser_ids }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Merge failed')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.tags() })
      toast.success('Tags merged')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}
