'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { settingsKeys } from './use-settings-data'
import { useToken } from './utils'
import { toast } from 'sonner'

export function useUpdateProfile() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { display_name: string; bio: string; theme: string }) => {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Failed to save profile')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.profile() })
      toast.success('Profile updated')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useUploadAvatar() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Failed to upload avatar')
      }
      return res.json() as Promise<{ avatar_url: string }>
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.profile() })
      toast.success('Avatar updated')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useDeleteAvatar() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/profile/avatar', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Failed to remove avatar')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.profile() })
      toast.success('Avatar removed')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

/* ─────────────────────────────────────────────
   Auth SDK mutations (direct Supabase Auth — no API routes)
───────────────────────────────────────────── */

export function useChangePassword() {
  return useMutation({
    mutationFn: async ({ password }: { password: string }) => {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      toast.success('Password updated')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useSignOutOthers() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut({ scope: 'others' })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      toast.success('Signed out of all other devices')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useEnrollMfa() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator',
      })
      if (error) throw new Error(error.message)
      return data
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useVerifyMfa() {
  return useMutation({
    mutationFn: async ({ factorId, code }: { factorId: string; code: string }) => {
      const { data, error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      toast.success('Two-factor authentication enabled')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useUnenrollMfa() {
  return useMutation({
    mutationFn: async ({ factorId }: { factorId: string }) => {
      const { data, error } = await supabase.auth.mfa.unenroll({ factorId })
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      toast.success('Two-factor authentication disabled')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}
