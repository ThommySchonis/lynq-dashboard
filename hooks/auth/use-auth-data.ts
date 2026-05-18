'use client'

import { useQuery } from '@tanstack/react-query'
import { parseJson } from '@/lib/utils/typed-json'

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

interface InviteDetailsResponse extends Partial<InviteDetails> {
  error?: string
}

export function useInviteDetails(token: string) {
  return useQuery<InviteDetails>({
    queryKey: authKeys.invite(token),
    queryFn: async () => {
      const res = await fetch(`/api/invites/${token}`)
      const body = await parseJson<InviteDetailsResponse>(res).catch((): InviteDetailsResponse => ({}))
      if (!res.ok || body.error) {
        throw new Error(body.error || 'Failed to load invite')
      }
      return body as InviteDetails
    },
    enabled: !!token,
    retry: false,
  })
}
