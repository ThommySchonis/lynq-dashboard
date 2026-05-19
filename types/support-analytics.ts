export interface ResponseTimeData {
  avg_response_time_seconds: number
  median_response_time_seconds: number
  total_conversations: number
}

export interface ResolutionTimeData {
  avg_resolution_time_seconds: number
  median_resolution_time_seconds: number
  total_resolved: number
}

export interface TicketVolumePoint {
  date: string
  opened_count: number
  resolved_count: number
}

export interface AgentProductivityRow {
  agent_id: string
  messages_sent: number
  tickets_resolved: number
  one_touch_count: number
  one_touch_rate: number
  avg_messages_per_ticket: number
}

export interface RefundReasonRow {
  reason: string
  count: number
  percentage: number
}

export interface SupportAnalyticsDateRange {
  from: string
  to: string
}
