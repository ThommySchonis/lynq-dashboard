'use client'

import { useQuery } from '@tanstack/react-query'
import { rpc } from '@/lib/rpc'

export const authKeys = {
  invite: (token: string) => ['invite', token] as const,
}

export interface InviteDetails {
  invite_email: string
  workspace_name: string
  role: string
  inviter_name?: string | null
  expires_at?: string | null
}

interface InviteDetailsResponse {
  ok?: boolean
  error?: string
  invite_email?: string
  workspace_name?: string
  role?: string
  inviter_name?: string | null
  expires_at?: string | null
}

export function useInviteDetails(token: string) {
  return useQuery<InviteDetails>({
    queryKey: authKeys.invite(token),
    queryFn: async () => {
      const data = await rpc<InviteDetailsResponse>('api_get_invite_details', { p_token: token })
      if (data.error) {
        throw new Error(data.error)
      }
      return {
        invite_email: data.invite_email!,
        workspace_name: data.workspace_name!,
        role: data.role!,
        inviter_name: data.inviter_name ?? null,
        expires_at: data.expires_at ?? null,
      }
    },
    enabled: !!token,
    retry: false,
  })
}
