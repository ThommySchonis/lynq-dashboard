'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { adminKeys } from './use-admin-data'
import { parseJson } from '@/lib/utils/typed-json'
import type { CreateClientForm, BroadcastForm, NotificationForm, TeamMemberForm, MasterclassForm } from '@/types/admin'
import { apiUrl } from '@/lib/api-client'

interface ErrorResponse {
  error?: string
}

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (form: CreateClientForm) => {
      const { error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      })
      if (authError) throw authError

      const { error: dbError } = await supabase.from('clients').insert({
        company_name: form.company_name,
        email: form.email,
        shopify_domain: form.shopify_domain || null,
        shopify_api_key: form.shopify_api_key || null,
        parcel_panel_api_key: form.parcel_panel_api_key || null,
        status: 'active',
      })
      if (dbError) throw dbError
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.clients() })
    },
  })
}

export function useCreateBroadcast() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (form: BroadcastForm) => {
      const { error } = await supabase.from('broadcasts').insert({
        title: form.title,
        body: form.body || null,
        type: form.type,
        youtube_url: form.youtube_url?.trim() || null,
        topic: form.topic?.trim() || null,
        image_url: form.type !== 'video' ? (form.image_url || null) : null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.broadcasts() })
      void qc.invalidateQueries({ queryKey: adminKeys.broadcastReactions() })
    },
  })
}

interface ImageUploadResponse {
  url: string
}

export function useUploadBroadcastImage() {
  const token = useToken()
  return useMutation({
    mutationFn: async (file: File): Promise<ImageUploadResponse> => {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(apiUrl('admin/broadcasts/image'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (!res.ok) {
        const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(d.error || 'Image upload failed')
      }
      return parseJson<ImageUploadResponse>(res)
    },
  })
}

export function useDeleteBroadcast() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('broadcasts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.broadcasts() })
      void qc.invalidateQueries({ queryKey: adminKeys.broadcastReactions() })
    },
  })
}

export function useTogglePin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, isPinned }: { id: string; isPinned: boolean }) => {
      if (!isPinned) {
        await supabase.from('broadcasts').update({ is_pinned: false }).eq('is_pinned', true)
      }
      const { error } = await supabase.from('broadcasts').update({ is_pinned: !isPinned }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.broadcasts() })
    },
  })
}

export function useCreateNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (form: NotificationForm) => {
      const { error } = await supabase.from('notifications').insert({
        title: form.title,
        body: form.body,
        type: form.type,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.notifications() })
    },
  })
}

export function useDeleteNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notifications').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.notifications() })
    },
  })
}

export function useMarkInquiryRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('service_inquiries').update({ status: 'read' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.inquiries() })
    },
  })
}

export function useCreateTeamMember() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (form: TeamMemberForm) => {
      const res = await fetch(apiUrl('admin/create-user'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      })
      const d = await parseJson<ErrorResponse>(res)
      if (!res.ok) throw new Error(d.error || 'Something went wrong')
      return d
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.team() })
    },
  })
}

export function useDeleteTeamMember() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await fetch(`${apiUrl('admin/delete-user')}?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.team() })
    },
  })
}

export function useCreateMasterclass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (form: MasterclassForm) => {
      const { error } = await supabase.from('masterclasses').insert({
        title: form.title,
        speaker: form.speaker?.trim() || null,
        description: form.description?.trim() || null,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        zoom_url: form.zoom_url?.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.masterclasses() })
    },
  })
}

export function useDeleteMasterclass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('masterclasses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.masterclasses() })
    },
  })
}

export function useUpdateZoomUrl() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, url }: { id: string; url: string }) => {
      const { error } = await supabase
        .from('masterclasses')
        .update({ zoom_url: url?.trim() || null })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.masterclasses() })
    },
  })
}

export function useSuspendClient() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await fetch(apiUrl(`admin/clients/${id}/suspend`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
      })
      const d = await parseJson<ErrorResponse>(res)
      if (!res.ok) throw new Error(d.error || 'Failed to suspend')
      return d
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.clients() })
      void qc.invalidateQueries({ queryKey: adminKeys.clientOverview() })
    },
  })
}

export function useUnsuspendClient() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(apiUrl(`admin/clients/${id}/unsuspend`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const d = await parseJson<ErrorResponse>(res)
      if (!res.ok) throw new Error(d.error || 'Failed to unsuspend')
      return d
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.clients() })
      void qc.invalidateQueries({ queryKey: adminKeys.clientOverview() })
    },
  })
}
