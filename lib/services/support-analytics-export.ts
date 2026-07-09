// lib/services/support-analytics-export.ts
//
// Support-analytics (Performance page) export service. Reads the five support
// stored functions via supabaseAdmin (RLS bypass; caller already authorized via
// getAuthContext), maps agent ids to display names, and serializes to CSV.

import { supabaseAdmin } from '../supabaseAdmin'
import { formatCSV } from '@/lib/services/data-export'
import { formatSeconds } from '@/lib/performance-utils'
import type {
  ResponseTimeData,
  ResolutionTimeData,
  TicketVolumePoint,
  AgentProductivityRow,
  RefundReasonRow,
  SupportAnalyticsBundle,
} from '@/types/support-analytics'

export interface SupportExportParams {
  workspaceId: string
  from: string
  to: string
  agentId: string | null
}

interface MemberDetailRow {
  id: string
  display_name: string | null
  email: string
}

async function rpcRows<T>(fn: string, params: Record<string, unknown>): Promise<T[]> {
  const result = await supabaseAdmin.rpc(fn, params)
  if (result.error) throw new Error(`${fn} failed: ${result.error.message}`)
  return (result.data as T[] | null) ?? []
}

/**
 * Fetch every support-analytics metric for the given range/agent, plus an
 * agent-id → display-name map. Calls the inner get_* functions (granted to
 * service_role) with an explicit p_workspace_id — the api_* wrappers derive the
 * workspace from the end-user JWT and cannot run under the service key.
 */
export async function fetchSupportAnalytics(params: SupportExportParams): Promise<SupportAnalyticsBundle> {
  const rpcParams = {
    p_workspace_id: params.workspaceId,
    p_agent_id: params.agentId,
    p_date_from: params.from,
    p_date_to: params.to,
  }

  const [responseRows, resolutionRows, ticketVolume, agentProductivity, refundReasons, membersRes] =
    await Promise.all([
      rpcRows<ResponseTimeData>('get_response_times', rpcParams),
      rpcRows<ResolutionTimeData>('get_resolution_times', rpcParams),
      rpcRows<TicketVolumePoint>('get_ticket_volume', rpcParams),
      rpcRows<AgentProductivityRow>('get_agent_productivity', rpcParams),
      rpcRows<RefundReasonRow>('get_refund_reasons', rpcParams),
      supabaseAdmin
        .from('workspace_member_details')
        .select('id, display_name, email')
        .eq('workspace_id', params.workspaceId),
    ])

  if (membersRes.error) throw new Error(`member lookup failed: ${membersRes.error.message}`)

  const agentNames: Record<string, string> = {}
  for (const m of (membersRes.data as MemberDetailRow[] | null) ?? []) {
    agentNames[m.id] = m.display_name ?? m.email
  }

  return {
    responseTime: (responseRows[0]?.total_conversations ?? 0) > 0 ? responseRows[0] : null,
    resolutionTime: (resolutionRows[0]?.total_resolved ?? 0) > 0 ? resolutionRows[0] : null,
    ticketVolume,
    agentProductivity,
    refundReasons,
    agentNames,
    range: { from: params.from, to: params.to },
    agentId: params.agentId,
  }
}

/** Aggregate the headline KPIs shared by the CSV and PDF serializers. */
export function computeSupportKpis(bundle: SupportAnalyticsBundle): {
  ticketsResolved: number
  oneTouchRatePct: number
} {
  const ticketsResolved = bundle.agentProductivity.reduce((s, r) => s + r.tickets_resolved, 0)
  const oneTouch = bundle.agentProductivity.reduce((s, r) => s + r.one_touch_count, 0)
  const oneTouchRatePct = ticketsResolved > 0 ? (oneTouch / ticketsResolved) * 100 : 0
  return { ticketsResolved, oneTouchRatePct }
}

/** Serialize the bundle to a multi-section CSV mirroring the Performance page. */
export function buildSupportAnalyticsCSV(bundle: SupportAnalyticsBundle): string {
  const { ticketsResolved, oneTouchRatePct } = computeSupportKpis(bundle)
  const sections: string[] = []

  const kpiRows: string[][] = [
    ['Avg Response Time', bundle.responseTime ? formatSeconds(bundle.responseTime.avg_response_time_seconds) : '—'],
    ['Median Response Time', bundle.responseTime ? formatSeconds(bundle.responseTime.median_response_time_seconds) : '—'],
    ['Avg Resolution Time', bundle.resolutionTime ? formatSeconds(bundle.resolutionTime.avg_resolution_time_seconds) : '—'],
    ['Median Resolution Time', bundle.resolutionTime ? formatSeconds(bundle.resolutionTime.median_resolution_time_seconds) : '—'],
    ['Tickets Resolved', String(ticketsResolved)],
    ['One-Touch Rate', `${oneTouchRatePct.toFixed(0)}%`],
    ['Total Conversations', String(bundle.responseTime?.total_conversations ?? 0)],
  ]
  sections.push('--- KPI Summary ---')
  sections.push(formatCSV(['Metric', 'Value'], kpiRows))

  const volumeRows: string[][] = bundle.ticketVolume.map((p) => [
    p.date,
    String(p.opened_count),
    String(p.resolved_count),
  ])
  sections.push('')
  sections.push('--- Ticket Volume ---')
  sections.push(formatCSV(['Date', 'Opened', 'Resolved'], volumeRows))

  const agentRows: string[][] = bundle.agentProductivity.map((r) => [
    bundle.agentNames[r.agent_id] ?? r.agent_id,
    String(r.messages_sent),
    String(r.tickets_resolved),
    String(r.one_touch_count),
    `${Number(r.one_touch_rate).toFixed(0)}%`,
    Number(r.avg_messages_per_ticket).toFixed(1),
  ])
  sections.push('')
  sections.push('--- Agent Productivity ---')
  sections.push(formatCSV(
    ['Agent', 'Messages Sent', 'Tickets Resolved', 'One-Touch Count', 'One-Touch Rate', 'Avg Messages / Ticket'],
    agentRows,
  ))

  const refundRows: string[][] = bundle.refundReasons.map((r) => [
    r.reason,
    String(r.count),
    `${Number(r.percentage).toFixed(1)}%`,
  ])
  sections.push('')
  sections.push('--- Refund Reasons ---')
  sections.push(formatCSV(['Reason', 'Count', 'Percentage'], refundRows))

  return sections.join('\r\n')
}

/** Fetch + serialize to CSV. */
export async function exportSupportAnalyticsCSV(params: SupportExportParams): Promise<string> {
  const bundle = await fetchSupportAnalytics(params)
  return buildSupportAnalyticsCSV(bundle)
}
