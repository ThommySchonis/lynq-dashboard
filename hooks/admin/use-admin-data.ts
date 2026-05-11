'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import type { Client, Broadcast, Notification, Inquiry, TeamMember, Masterclass, BroadcastReaction, FinanceData, TimeData } from '@/types/admin'

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
}

export function useClients() {
  return useQuery<Client[]>({
    queryKey: adminKeys.clients(),
    queryFn: async () => {
      const { data } = await supabase
        .from('clients').select('*')
        .order('created_at', { ascending: false })
      return (data as Client[]) ?? []
    },
  })
}

export function useBroadcasts() {
  return useQuery<Broadcast[]>({
    queryKey: adminKeys.broadcasts(),
    queryFn: async () => {
      const { data } = await supabase
        .from('broadcasts').select('*')
        .order('created_at', { ascending: false })
      return (data as Broadcast[]) ?? []
    },
  })
}

export function useBroadcastReactions() {
  return useQuery<BroadcastReaction[]>({
    queryKey: adminKeys.broadcastReactions(),
    queryFn: async () => {
      const { data } = await supabase
        .from('broadcast_reactions').select('broadcast_id, emoji')
      return (data as BroadcastReaction[]) ?? []
    },
  })
}

export function useNotifications() {
  return useQuery<Notification[]>({
    queryKey: adminKeys.notifications(),
    queryFn: async () => {
      const { data } = await supabase
        .from('notifications').select('*')
        .order('created_at', { ascending: false })
      return (data as Notification[]) ?? []
    },
  })
}

export function useInquiries() {
  return useQuery<Inquiry[]>({
    queryKey: adminKeys.inquiries(),
    queryFn: async () => {
      const { data } = await supabase
        .from('service_inquiries').select('*')
        .order('created_at', { ascending: false })
      return (data as Inquiry[]) ?? []
    },
  })
}

export function useTeamMembers() {
  return useQuery<TeamMember[]>({
    queryKey: adminKeys.team(),
    queryFn: async () => {
      const { data } = await supabase
        .from('team_members').select('*')
        .order('created_at', { ascending: false })
      return (data as TeamMember[]) ?? []
    },
  })
}

export function useMasterclasses() {
  return useQuery<Masterclass[]>({
    queryKey: adminKeys.masterclasses(),
    queryFn: async () => {
      const { data } = await supabase
        .from('masterclasses').select('*')
        .order('scheduled_at', { ascending: false })
      return (data as Masterclass[]) ?? []
    },
  })
}

export function useTimeData(filter: string) {
  const token = useToken()
  return useQuery<TimeData>({
    queryKey: adminKeys.time(filter),
    queryFn: async () => {
      const res = await fetch(`/api/time?filter=${filter}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch time data')
      return res.json()
    },
    enabled: !!token,
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
      return res.json()
    },
    enabled: !!token && !!email,
  })
}

export function useFeedbackCount() {
  const token = useToken()
  return useQuery<number>({
    queryKey: adminKeys.feedbackCount(),
    queryFn: async () => {
      const res = await fetch('/api/lynq-admin/feedback/count', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (!res.ok) return 0
      const d = await res.json().catch(() => ({}))
      return typeof d.count === 'number' ? d.count : 0
    },
    enabled: !!token,
  })
}
