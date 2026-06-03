'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { rpc } from '@/lib/rpc'
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

function rpcParams(range: SupportAnalyticsDateRange, agentId?: string) {
  return {
    p_agent_id: agentId ?? null,
    p_date_from: range.from,
    p_date_to: range.to,
  }
}

export function useResponseTime(range: SupportAnalyticsDateRange, agentId?: string) {
  const token = useToken()
  return useQuery<ResponseTimeData>({
    queryKey: supportAnalyticsKeys.responseTime(range, agentId),
    queryFn: async () => {
      const d = await rpc<{ data: ResponseTimeData }>('api_get_response_times', rpcParams(range, agentId))
      return d.data
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
      const d = await rpc<{ data: ResolutionTimeData }>('api_get_resolution_times', rpcParams(range, agentId))
      return d.data
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
      const d = await rpc<{ data: TicketVolumePoint[] }>('api_get_ticket_volume', rpcParams(range, agentId))
      return d.data
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
      const d = await rpc<{ data: AgentProductivityRow[] }>('api_get_agent_productivity', rpcParams(range, agentId))
      return d.data
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
      const d = await rpc<{ data: RefundReasonRow[] }>('api_get_refund_reasons', rpcParams(range, agentId))
      return d.data
    },
    enabled: !!token,
    staleTime: 5 * 60_000,
  })
}
