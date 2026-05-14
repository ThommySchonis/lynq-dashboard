export type TimeFilter = 'today' | 'week' | 'month'

export type ClockState = 'idle' | 'active' | 'paused'

export interface Session {
  id: string
  user_id: string
  member_name?: string
  clocked_in_at: string
  clocked_out_at: string | null
  active_seconds: number
  idle_seconds: number
  is_paused: boolean
  status: 'active' | 'paused' | 'ended'
  paused_at: string | null
  paused_seconds: number
  // Legacy free-text report — populated for sessions clocked out before
  // the structured EOD fields shipped. Kept for backwards compatibility.
  eod_report: string | null
  // Structured EOD fields — required at clock-out time for new sessions,
  // null for sessions that pre-date this column set.
  emails_answered: number | null
  what_went_well:  string | null
  needs_attention: string | null
}

export interface EodReport {
  emailsAnswered: number
  whatWentWell:   string
  needsAttention: string
}

export interface TeamMember {
  id: string
  name: string
  role: string
  is_active: boolean
  is_paused: boolean
  worked_seconds: number
  sessions_count: number
}

export interface TeamData {
  members: TeamMember[]
  sessions: Session[]
  active_count: number
  paused_count: number
  client?: {
    company_name: string
  }
}

export interface TeamKpiDef {
  key: string
  label: string | null
}
