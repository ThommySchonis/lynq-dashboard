'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { settingsKeys } from '@/hooks/settings/use-settings-data'
import { apiUrl } from '@/lib/api-client'
import type { EmailDisplaySettings } from '@/types/settings'
import { toast } from 'sonner'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

interface DisplaySettingsResponse {
  settings: EmailDisplaySettings[]
}

interface UpsertResponse {
  settings: EmailDisplaySettings
}

interface UploadResponse {
  logoUrl: string
}

export function useEmailDisplaySettings(storeId: string | null) {
  const token = useToken()
  return useQuery<EmailDisplaySettings[]>({
    queryKey: settingsKeys.emailDisplay(storeId ?? ''),
    queryFn: async () => {
      const res = await fetch(apiUrl(`settings/email-display?storeId=${storeId}`), {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load display settings')
      const data = (await res.json()) as DisplaySettingsResponse
      return data.settings
    },
    enabled: !!token && !!storeId,
    staleTime: 5 * 60_000,
  })
}

interface UpsertParams {
  storeId: string
  emailAccountId?: string | null
  displayName?: string | null
  closingText?: string | null
  signatureHtml?: string | null
  logoUrl?: string | null
  logoWidth?: number
  logoLinkUrl?: string | null
  isActive?: boolean
}

export function useSaveEmailDisplaySettings(storeId: string | null) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: UpsertParams) => {
      const res = await fetch(apiUrl('settings/email-display'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: 'Failed to save' }))) as { error?: string }
        throw new Error(err.error ?? 'Failed to save')
      }
      return (await res.json()) as UpsertResponse
    },
    onSuccess: () => {
      if (storeId) {
        void qc.invalidateQueries({ queryKey: settingsKeys.emailDisplay(storeId) })
      }
      toast.success('Email display settings saved')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useDeleteEmailDisplaySettings(storeId: string | null) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(apiUrl(`settings/email-display/${id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to delete override')
    },
    onSuccess: () => {
      if (storeId) {
        void qc.invalidateQueries({ queryKey: settingsKeys.emailDisplay(storeId) })
      }
      toast.success('Account override removed')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useUploadSignatureLogo() {
  const token = useToken()
  return useMutation({
    mutationFn: async ({ file, storeId }: { file: File; storeId: string }) => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('storeId', storeId)
      const res = await fetch(apiUrl('settings/email-display/upload-logo'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: 'Upload failed' }))) as { error?: string }
        throw new Error(err.error ?? 'Upload failed')
      }
      return (await res.json()) as UploadResponse
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}
