'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { parseJson } from '@/lib/utils/typed-json'
import type {
  ResponseTimeData,
  ResolutionTimeData,
  TicketVolumePoint,
  AgentProductivityRow,
  RefundReasonRow,
  SupportAnalyticsDateRange,
} from '@/types/support-analytics'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const supportAnalyticsKeys = {
  all: ['supportAnalytics'] as const,
  responseTime: (range: SupportAnalyticsDateRange, agentId?: string) =>
    [...supportAnalyticsKeys.all, 'responseTime', range.from, range.to, agentId ?? ''] as const,
  resolutionTime: (range: SupportAnalyticsDateRange, agentId?: string) =>
    [...supportAnalyticsKeys.all, 'resolutionTime', range.from, range.to, agentId ?? ''] as const,
  ticketVolume: (range: SupportAnalyticsDateRange, agentId?: string) =>
    [...supportAnalyticsKeys.all, 'ticketVolume', range.from, range.to, agentId ?? ''] as const,
  agentProductivity: (range: SupportAnalyticsDateRange, agentId?: string) =>
    [...supportAnalyticsKeys.all, 'agentProductivity', range.from, range.to, agentId ?? ''] as const,
  refundReasons: (range: SupportAnalyticsDateRange, agentId?: string) =>
    [...supportAnalyticsKeys.all, 'refundReasons', range.from, range.to, agentId ?? ''] as const,
}

function buildParams(range: SupportAnalyticsDateRange, agentId?: string): string {
  const params = new URLSearchParams()
  params.set('date_from', range.from)
  params.set('date_to', range.to)
  if (agentId) params.set('agent_id', agentId)
  return params.toString()
}

export function useResponseTime(range: SupportAnalyticsDateRange, agentId?: string) {
  const token = useToken()
  return useQuery<ResponseTimeData>({
    queryKey: supportAnalyticsKeys.responseTime(range, agentId),
    queryFn: async () => {
      const res = await fetch(`/api/analytics/support/response-time?${buildParams(range, agentId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch response time')
      const json = await parseJson<{ data: ResponseTimeData }>(res)
      return json.data
    },
    enabled: !!token,
    staleTime: 5 * 60_000,
  })
}

export function useResolutionTime(range: SupportAnalyticsDateRange, agentId?: string) {
  const token = useToken()
  return useQuery<ResolutionTimeData>({
    queryKey: supportAnalyticsKeys.resolutionTime(range, agentId),
    queryFn: async () => {
      const res = await fetch(`/api/analytics/support/resolution-time?${buildParams(range, agentId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch resolution time')
      const json = await parseJson<{ data: ResolutionTimeData }>(res)
      return json.data
    },
    enabled: !!token,
    staleTime: 5 * 60_000,
  })
}

export function useTicketVolume(range: SupportAnalyticsDateRange, agentId?: string) {
  const token = useToken()
  return useQuery<TicketVolumePoint[]>({
    queryKey: supportAnalyticsKeys.ticketVolume(range, agentId),
    queryFn: async () => {
      const res = await fetch(`/api/analytics/support/ticket-volume?${buildParams(range, agentId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch ticket volume')
      const json = await parseJson<{ data: TicketVolumePoint[] }>(res)
      return json.data
    },
    enabled: !!token,
    staleTime: 5 * 60_000,
  })
}

export function useAgentProductivity(range: SupportAnalyticsDateRange, agentId?: string) {
  const token = useToken()
  return useQuery<AgentProductivityRow[]>({
    queryKey: supportAnalyticsKeys.agentProductivity(range, agentId),
    queryFn: async () => {
      const res = await fetch(`/api/analytics/support/agent-productivity?${buildParams(range, agentId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch agent productivity')
      const json = await parseJson<{ data: AgentProductivityRow[] }>(res)
      return json.data
    },
    enabled: !!token,
    staleTime: 5 * 60_000,
  })
}

export function useRefundReasons(range: SupportAnalyticsDateRange, agentId?: string) {
  const token = useToken()
  return useQuery<RefundReasonRow[]>({
    queryKey: supportAnalyticsKeys.refundReasons(range, agentId),
    queryFn: async () => {
      const res = await fetch(`/api/analytics/support/refund-reasons?${buildParams(range, agentId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch refund reasons')
      const json = await parseJson<{ data: RefundReasonRow[] }>(res)
      return json.data
    },
    enabled: !!token,
    staleTime: 5 * 60_000,
  })
}
