import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  SupportAnalyticsBundle,
  ResponseTimeData,
  ResolutionTimeData,
} from '@/types/support-analytics'

const rpc = vi.fn()
vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    rpc: (...a: unknown[]): unknown => rpc(...a),
    from: () => ({
      select: () => ({
        eq: async () => ({ data: [], error: null }),
      }),
    }),
  },
}))

import {
  buildSupportAnalyticsCSV,
  computeSupportKpis,
  fetchSupportAnalytics,
} from '@/lib/services/support-analytics-export'

const bundle: SupportAnalyticsBundle = {
  responseTime: { avg_response_time_seconds: 150, median_response_time_seconds: 120, total_conversations: 10 },
  resolutionTime: { avg_resolution_time_seconds: 3720, median_resolution_time_seconds: 3600, total_resolved: 8 },
  ticketVolume: [{ date: '2026-07-01', opened_count: 5, resolved_count: 4 }],
  agentProductivity: [
    { agent_id: 'a1', messages_sent: 20, tickets_resolved: 8, one_touch_count: 6, one_touch_rate: 75, avg_messages_per_ticket: 2.5 },
  ],
  refundReasons: [{ reason: 'Damaged, broken', count: 3, percentage: 42.5 }],
  agentNames: { a1: 'Alice' },
  range: { from: '2026-07-01', to: '2026-07-08' },
  agentId: null,
}

describe('computeSupportKpis', () => {
  it('sums tickets and derives one-touch rate', () => {
    expect(computeSupportKpis(bundle)).toEqual({ ticketsResolved: 8, oneTouchRatePct: 75 })
  })
  it('returns a zero rate when no tickets were resolved', () => {
    expect(computeSupportKpis({ ...bundle, agentProductivity: [] })).toEqual({ ticketsResolved: 0, oneTouchRatePct: 0 })
  })
})

describe('buildSupportAnalyticsCSV', () => {
  it('emits all four labelled sections with formatted values', () => {
    const csv = buildSupportAnalyticsCSV(bundle)
    expect(csv).toContain('--- KPI Summary ---')
    expect(csv).toContain('Avg Response Time,2m 30s')
    expect(csv).toContain('Avg Resolution Time,1h 2m')
    expect(csv).toContain('One-Touch Rate,75%')
    expect(csv).toContain('--- Ticket Volume ---')
    expect(csv).toContain('2026-07-01,5,4')
    expect(csv).toContain('--- Agent Productivity ---')
    expect(csv).toContain('Alice,20,8,6,75%,2.5')
    expect(csv).toContain('--- Refund Reasons ---')
    // reason contains a comma → RFC-4180 quoted
    expect(csv).toContain('"Damaged, broken",3,42.5%')
  })
  it('falls back to the raw agent id when no name is known', () => {
    const csv = buildSupportAnalyticsCSV({ ...bundle, agentNames: {} })
    expect(csv).toContain('a1,20,8,6,75%,2.5')
  })
  it('renders an em dash when response/resolution data is null', () => {
    const csv = buildSupportAnalyticsCSV({ ...bundle, responseTime: null, resolutionTime: null })
    expect(csv).toContain('Avg Response Time,—')
    expect(csv).toContain('Avg Resolution Time,—')
  })
})

const params = { workspaceId: 'w1', from: '2026-07-01', to: '2026-07-08', agentId: null }

function mockRpcRows(response: ResponseTimeData[], resolution: ResolutionTimeData[]): void {
  rpc.mockImplementation(async (fn: string) => {
    switch (fn) {
      case 'get_response_times':
        return { data: response, error: null }
      case 'get_resolution_times':
        return { data: resolution, error: null }
      case 'get_ticket_volume':
      case 'get_agent_productivity':
      case 'get_refund_reasons':
        return { data: [], error: null }
      default:
        throw new Error(`unexpected rpc: ${fn}`)
    }
  })
}

describe('fetchSupportAnalytics', () => {
  beforeEach(() => {
    rpc.mockReset()
  })

  it('nulls out responseTime/resolutionTime when the single aggregate row has zero totals', async () => {
    mockRpcRows(
      [{ avg_response_time_seconds: 0, median_response_time_seconds: 0, total_conversations: 0 }],
      [{ avg_resolution_time_seconds: 0, median_resolution_time_seconds: 0, total_resolved: 0 }],
    )
    const bundleResult = await fetchSupportAnalytics(params)
    expect(bundleResult.responseTime).toBeNull()
    expect(bundleResult.resolutionTime).toBeNull()
  })

  it('keeps the aggregate row when totals are positive', async () => {
    const responseRow: ResponseTimeData = { avg_response_time_seconds: 150, median_response_time_seconds: 120, total_conversations: 10 }
    const resolutionRow: ResolutionTimeData = { avg_resolution_time_seconds: 3720, median_resolution_time_seconds: 3600, total_resolved: 8 }
    mockRpcRows([responseRow], [resolutionRow])
    const bundleResult = await fetchSupportAnalytics(params)
    expect(bundleResult.responseTime).toEqual(responseRow)
    expect(bundleResult.resolutionTime).toEqual(resolutionRow)
  })
})
