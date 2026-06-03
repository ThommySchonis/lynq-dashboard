'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsKeys } from './use-settings-data'
import { useToken } from './utils'
import { toast } from 'sonner'
import { parseJson } from '@/lib/utils/typed-json'
import { rpc } from '@/lib/rpc'
import { apiUrl } from '@/lib/api-client'
import type { MemberRole } from '@/types/settings'

interface ErrorResponse {
  error?: string
}

interface ResendInviteResponse {
  emailStatus?: string
  emailError?: string
}

export function useInviteMember() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role: MemberRole }) => {
      const res = await fetch(apiUrl('workspaces/current/members'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email, role }),
      })
      if (!res.ok) {
        const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(d.error ||'Failed to invite member')
      }
      return parseJson<unknown>(res)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsKeys.members() })
      toast.success('Invitation sent')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useUpdateMemberRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: MemberRole }) => {
      return rpc('api_update_member_role', { p_member_id: id, p_role: role })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsKeys.members() })
      toast.success('Role updated')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useRemoveMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      return rpc('api_remove_member', { p_member_id: id })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsKeys.members() })
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
      const res = await fetch(apiUrl(`workspaces/current/invites/${id}/resend`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(d.error ||'Failed to resend invite')
      }
      return parseJson<ResendInviteResponse>(res)
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: settingsKeys.members() })
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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      return rpc('api_revoke_invite', { p_invite_id: id })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsKeys.members() })
      toast.success('Invite revoked')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}
