'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { parseJson } from '@/lib/utils/typed-json'
import { rpc } from '@/lib/rpc'
import { apiUrl } from '@/lib/api-client'
import type { Client, Broadcast, Notification, Inquiry, TeamMember, Masterclass, BroadcastReaction, FinanceData, TimeData } from '@/types/admin'

interface FeedbackCountResponse {
  count?: unknown
}

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const adminKeys = {
  all: ['admin'] as const,
  clients: () => [...adminKeys.all, 'clients'] as const,
  broadcasts: () => [...adminKeys.all, 'broadcasts'] as const,
  notifications: () => [...adminKeys.all, 'notifications'] as const,
  inquiries: () => [...adminKeys.all, 'inquiries'] as const,
  team: () => [...adminKeys.all, 'team'] as const,
  time: (filter: string) => [...adminKeys.all, 'time', filter] as const,
  finance: () => [...adminKeys.all, 'finance'] as const,
  masterclasses: () => [...adminKeys.all, 'masterclasses'] as const,
  broadcastReactions: () => [...adminKeys.all, 'broadcast-reactions'] as const,
  feedbackCount: () => [...adminKeys.all, 'feedback-count'] as const,
  clientOverview: () => [...adminKeys.all, 'client-overview'] as const,
}

interface ClientRow {
  id: string
  company_name: string
  email: string
  shopify_domain: string | null
  shopify_api_key: string | null
  parcel_panel_api_key: string | null
  status: 'active' | 'inactive'
  created_at: string
  workspaces: { suspended_at: string | null; suspension_reason: string | null } | null
}

export function useClients() {
  return useQuery<Client[]>({
    queryKey: adminKeys.clients(),
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('*, workspaces(suspended_at, suspension_reason)')
        .order('created_at', { ascending: false })

      // Flatten the joined workspace data into each client
      return (data as ClientRow[] ?? []).map((row) => {
        const ws = row.workspaces
        return {
          ...row,
          suspended_at: ws?.suspended_at ?? null,
          suspension_reason: ws?.suspension_reason ?? null,
          workspaces: undefined, // remove the nested join object
        }
      }) as Client[]
    },
    staleTime: 5 * 60_000,
  })
}

export function useBroadcasts() {
  return useQuery<Broadcast[]>({
    queryKey: adminKeys.broadcasts(),
    queryFn: async () => {
      const { data } = await supabase
        .from('broadcasts').select('*')
        .order('created_at', { ascending: false })
      return (data ?? []) as Broadcast[]
    },
    staleTime: 5 * 60_000,
  })
}

export function useBroadcastReactions() {
  return useQuery<BroadcastReaction[]>({
    queryKey: adminKeys.broadcastReactions(),
    queryFn: async () => {
      const { data } = await supabase
        .from('broadcast_reactions').select('broadcast_id, emoji')
      return (data ?? []) as BroadcastReaction[]
    },
    staleTime: 5 * 60_000,
  })
}

export function useNotifications() {
  return useQuery<Notification[]>({
    queryKey: adminKeys.notifications(),
    queryFn: async () => {
      const { data } = await supabase
        .from('notifications').select('*')
        .order('created_at', { ascending: false })
      return (data ?? []) as Notification[]
    },
    staleTime: 5 * 60_000,
  })
}

export function useInquiries() {
  return useQuery<Inquiry[]>({
    queryKey: adminKeys.inquiries(),
    queryFn: async () => {
      const { data } = await supabase
        .from('service_inquiries').select('*')
        .order('created_at', { ascending: false })
      return (data ?? []) as Inquiry[]
    },
    staleTime: 5 * 60_000,
  })
}

export function useTeamMembers() {
  const token = useToken()
  return useQuery<TeamMember[]>({
    queryKey: adminKeys.team(),
    queryFn: async () => {
      // Goes through /api/admin/team which reads workspace_members joined
      // with auth.users + user_profiles. The anon supabase client can't do
      // that join, so server-side is the only path.
      const res = await fetch('/api/admin/team', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return []
      return parseJson<TeamMember[]>(res)
    },
    enabled: !!token,
    staleTime: 5 * 60_000,
  })
}

export function useMasterclasses() {
  return useQuery<Masterclass[]>({
    queryKey: adminKeys.masterclasses(),
    queryFn: async () => {
      const { data } = await supabase
        .from('masterclasses').select('*')
        .order('scheduled_at', { ascending: false })
      return (data ?? []) as Masterclass[]
    },
    staleTime: 5 * 60_000,
  })
}

export function useTimeData(filter: string) {
  const token = useToken()
  return useQuery<TimeData>({
    queryKey: adminKeys.time(filter),
    queryFn: async () => {
      return rpc<TimeData>('api_list_time_sessions', { p_filter: filter })
    },
    enabled: !!token,
    staleTime: 5 * 60_000,
  })
}

export function useFinance() {
  const token = useToken()
  const email = useAuthStore((s) => s.user?.email ?? '')
  return useQuery<FinanceData>({
    queryKey: adminKeys.finance(),
    queryFn: async () => {
      const res = await fetch('/api/admin/finance', {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-admin-email': email,
        },
      })
      if (!res.ok) throw new Error('Failed to fetch finance data')
      return parseJson<FinanceData>(res)
    },
    enabled: !!token && !!email,
    staleTime: 5 * 60_000,
  })
}

export function useFeedbackCount() {
  const token = useToken()
  return useQuery<number>({
    queryKey: adminKeys.feedbackCount(),
    queryFn: async () => {
      const res = await fetch(apiUrl('lynq-admin/feedback/count'), {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (!res.ok) return 0
      const d = await parseJson<FeedbackCountResponse>(res).catch((): FeedbackCountResponse => ({}))
      return typeof d.count === 'number' ? d.count : 0
    },
    enabled: !!token,
    staleTime: 5 * 60_000,
  })
}
