'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsKeys } from './use-settings-data'
import { useToken } from './utils'
import { toast } from 'sonner'
import type { MemberRole } from '@/types/settings'

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
