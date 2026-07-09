import { describe, it, expect } from 'vitest'
import { buildSupportReportData } from '@/lib/services/support-analytics-export-pdf'
import type { SupportAnalyticsBundle } from '@/types/support-analytics'

const bundle: SupportAnalyticsBundle = {
  responseTime: { avg_response_time_seconds: 150, median_response_time_seconds: 120, total_conversations: 10 },
  resolutionTime: { avg_resolution_time_seconds: 3720, median_resolution_time_seconds: 3600, total_resolved: 8 },
  ticketVolume: [{ date: '2026-07-01', opened_count: 5, resolved_count: 4 }],
  agentProductivity: [
    { agent_id: 'a1', messages_sent: 20, tickets_resolved: 8, one_touch_count: 6, one_touch_rate: 75, avg_messages_per_ticket: 2.5 },
  ],
  refundReasons: [{ reason: 'Damaged', count: 3, percentage: 42.5 }],
  agentNames: { a1: 'Alice' },
  range: { from: '2026-07-01', to: '2026-07-08' },
  agentId: 'a1',
}

describe('buildSupportReportData', () => {
  it('maps KPIs, tables, and the selected agent name', () => {
    const data = buildSupportReportData(bundle)
    expect(data.kpis).toEqual({
      avgResponse: '2m 30s',
      avgResolution: '1h 2m',
      ticketsResolved: 8,
      oneTouchRate: '75%',
    })
    expect(data.agentName).toBe('Alice')
    expect(data.ticketVolume).toEqual([{ date: '2026-07-01', opened: 5, resolved: 4 }])
    expect(data.agents).toEqual([
      { name: 'Alice', messagesSent: 20, ticketsResolved: 8, oneTouchRate: '75%', avgMessages: '2.5' },
    ])
    expect(data.refundReasons).toEqual([{ reason: 'Damaged', count: 3, percentage: '42.5%' }])
  })
  it('leaves agentName null when no agent filter is set', () => {
    expect(buildSupportReportData({ ...bundle, agentId: null }).agentName).toBeNull()
  })
  it('shows em dashes when response/resolution data is null', () => {
    const data = buildSupportReportData({ ...bundle, responseTime: null, resolutionTime: null })
    expect(data.kpis.avgResponse).toBe('—')
    expect(data.kpis.avgResolution).toBe('—')
  })
})
