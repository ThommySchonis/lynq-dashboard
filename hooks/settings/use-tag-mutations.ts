'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsKeys } from './use-settings-data'
import { rpc } from '@/lib/rpc'
import { toast } from 'sonner'
import type { TagForm } from '@/types/settings'

export function useCreateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (form: TagForm) => {
      return rpc('api_create_tag', {
        p_name: form.name,
        p_color: form.color,
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsKeys.tags() })
      toast.success('Tag created')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useUpdateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...form }: TagForm & { id: string }) => {
      return rpc('api_update_tag', {
        p_id: id,
        p_name: form.name,
        p_color: form.color,
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsKeys.tags() })
      toast.success('Tag updated')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useDeleteTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      return rpc('api_delete_tag', { p_id: id })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsKeys.tags() })
      toast.success('Tag deleted')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useMergeTags() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ winner_id, loser_ids }: { winner_id: string; loser_ids: string[] }) => {
      return rpc('api_merge_tags', {
        p_winner_id: winner_id,
        p_loser_ids: loser_ids,
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsKeys.tags() })
      toast.success('Tags merged')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}
