'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { settingsKeys } from './use-settings-data'
import { toast } from 'sonner'
import type {
  MemberRole,
  CustomEmailConfig,
  MacroOnboarding,
  TagForm,
} from '@/types/settings'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

/* ─────────────────────────────────────────────
   Workspace mutations
───────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────
   Member mutations
───────────────────────────────────────────── */

export function useInviteMember() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role: MemberRole }) => {
      const res = await fetch('/api/workspaces/current/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email, role }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Failed to invite member')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.members() })
      toast.success('Invitation sent')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useUpdateMemberRole() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: MemberRole }) => {
      const res = await fetch(`/api/workspaces/current/members/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Failed to update role')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.members() })
      toast.success('Role updated')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useRemoveMember() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/workspaces/current/members/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Failed to remove member')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.members() })
      toast.success('Member removed')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useResendInvite() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/workspaces/current/invites/${id}/resend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Failed to resend invite')
      }
      return res.json() as Promise<{ emailStatus?: string; emailError?: string }>
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: settingsKeys.members() })
      if (data.emailStatus === 'sent') {
        toast.success('Invite resent')
      } else if (data.emailStatus === 'not_configured') {
        toast.info('Invite refreshed — email service not configured')
      } else if (data.emailStatus === 'failed') {
        toast.error(`Invite refreshed but email failed: ${data.emailError}`)
      } else {
        toast.success('Invite refreshed')
      }
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useRevokeInvite() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/workspaces/current/invites/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Failed to revoke invite')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.members() })
      toast.success('Invite revoked')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

/* ─────────────────────────────────────────────
   Profile mutations
───────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────
   Macro mutations
───────────────────────────────────────────── */

export function useDuplicateMacro() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/macros/${id}/duplicate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Failed to duplicate macro')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.macros({ search: '', language: '', tags: [], archived: false }) })
      toast.success('Macro duplicated')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useArchiveMacro() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/macros/${id}/archive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Failed to archive macro')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...settingsKeys.all, 'macros'] })
      toast.success('Macro archived')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useRestoreMacro() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/macros/${id}/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Failed to restore macro')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...settingsKeys.all, 'macros'] })
      toast.success('Macro restored')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useDeleteMacro() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/macros/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Failed to delete macro')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...settingsKeys.all, 'macros'] })
      toast.success('Macro deleted')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useSaveMacroOnboarding() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (answers: MacroOnboarding) => {
      const res = await fetch('/api/macros/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ answers }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Failed to save onboarding')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.macroOnboarding() })
      toast.success('Onboarding saved')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useGenerateMacros() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body?: Record<string, unknown>) => {
      const res = await fetch('/api/macros/generate', {
        method: 'POST',
        headers: body
          ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
          : { Authorization: `Bearer ${token}` },
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Generation failed')
      }
      return res.json() as Promise<{ ok: boolean; count: number }>
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [...settingsKeys.all, 'macros'] })
      toast.success(`${data.count} macros created`)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

/* ─────────────────────────────────────────────
   Tag mutations
───────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────
   Email mutations
───────────────────────────────────────────── */

export function useConnectCustomEmail() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (config: CustomEmailConfig) => {
      const res = await fetch('/api/auth/custom-email/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(config),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Failed to connect email')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.emailAccounts() })
      toast.success('Email account connected')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useDisconnectEmail() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/inbox/accounts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Failed to disconnect email')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.emailAccounts() })
      toast.success('Email account disconnected')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

/* ─────────────────────────────────────────────
   Shopify mutations
───────────────────────────────────────────── */

export function useConnectShopify() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ domain, access_token }: { domain: string; access_token: string }) => {
      const res = await fetch('/api/shopify/manual-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ shop: domain, accessToken: access_token }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Failed to connect Shopify')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.shopify() })
      toast.success('Shopify connected')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useDisconnectShopify() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/shopify/manual-connect', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Failed to disconnect Shopify')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.shopify() })
      toast.success('Shopify disconnected')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}
