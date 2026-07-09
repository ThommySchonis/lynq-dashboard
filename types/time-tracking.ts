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
  // DB writes 'completed' on clock-out (api_time_clock_out); 'active'/'paused'
  // are the open-session states. The type mirrors the stored values exactly —
  // there is no 'ended'.
  status: 'active' | 'paused' | 'completed'
  paused_at: string | null
  paused_seconds: number
  // Legacy free-text report — populated for sessions clocked out before
  // the structured EOD fields shipped. Kept for backwards compatibility.
  eod_report: string | null
  // Structured EOD fields — null for sessions that pre-date this column set.
  what_went_well:  string | null
  needs_attention: string | null
  // Self-reported shift mood ('tough' | 'steady' | 'great'); null for
  // sessions clocked out before the mood column shipped.
  mood: string | null
  // Manual-edit audit summary — populated from time_session_edits for
  // admin/owner views. Null when the session has never been edited.
  last_edit_at?: string | null
  last_edit_by?: string | null
  // agent_id (= auth.users.id) is present in admin-view payloads; the
  // employee-view rows from /api/time include it too. Marked optional
  // for backwards-compat with old types.
  agent_id?: string
}

export interface EodReport {
  // Single free-text report (the only field the redesigned EOD modal
  // collects). needsAttention stays in the type for the admin edit path
  // and legacy callers, but the modal sends it null.
  whatWentWell:   string
  needsAttention: string | null
  // Self-reported shift mood ('tough' | 'steady' | 'great').
  mood: string | null
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

// Real per-agent, per-day activity shown in the End-of-Day modal's impact
// tiles. Returned by the api_get_eod_impact RPC (today, current member).
export interface EodImpact {
  tickets_resolved:    number
  messages_sent:       number
  emma_drafts_handled: number
}
