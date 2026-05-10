export interface Client {
  id: string
  company_name: string
  email: string
  shopify_domain: string | null
  shopify_api_key: string | null
  parcel_panel_api_key: string | null
  status: 'active' | 'inactive'
  created_at: string
}

export interface Broadcast {
  id: string
  title: string
  body: string | null
  type: BroadcastType
  youtube_url: string | null
  topic: string | null
  is_pinned: boolean
  created_at: string
}

export type BroadcastType = 'update' | 'tip' | 'video' | 'industry'

export interface Notification {
  id: string
  title: string
  body: string
  type: NotificationType
  created_at: string
}

export type NotificationType = 'info' | 'warning' | 'alert'

export interface Inquiry {
  id: string
  service: string
  client_email: string | null
  phone_number: string | null
  message: string | null
  status: 'new' | 'read'
  created_at: string
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: 'developer' | 'manager'
  created_at: string
}

export interface Masterclass {
  id: string
  title: string
  speaker: string | null
  description: string | null
  scheduled_at: string
  zoom_url: string | null
}

export interface BroadcastReaction {
  broadcast_id: string
  emoji: string
}

export interface FinanceData {
  finance: {
    mrr: number
    totalCostMonth: number
    fixedCosts: number
    netMargin: number
    marginPct: number
    activeClients: number
    aiCostMonth: number
  }
  ai: {
    today: { cost: number; calls: number }
    week: { cost: number; calls: number; input_tokens: number; output_tokens: number }
    month: { cost: number; calls: number; input_tokens: number; output_tokens: number }
    lastMonth: { cost: number }
    daily: Array<{ date: string; cost: number; calls: number }>
    byRoute: Record<string, { cost: number; calls: number; input_tokens: number; output_tokens: number }>
  }
  subscriptions: Array<{ name: string; cost: number; note: string | null }>
}

export interface TimeSession {
  id: string
  member_name: string
  member_email: string
  clocked_in_at: string
  clocked_out_at: string | null
  active_seconds: number
  paused_seconds: number
  eod_report: string | null
}

export interface TimeMember {
  name: string
  email: string
  worked_seconds: number
  paused_seconds: number
  sessions_count: number
  is_active: boolean
  is_paused: boolean
}

export interface TimeData {
  sessions: TimeSession[]
  members: TimeMember[]
  active_count: number
  paused_count: number
}

export interface CreateClientForm {
  company_name: string
  email: string
  password: string
  shopify_domain: string
  shopify_api_key: string
  parcel_panel_api_key: string
}

export interface BroadcastForm {
  title: string
  body: string
  type: BroadcastType
  youtube_url: string
  topic: string
}

export interface NotificationForm {
  title: string
  body: string
  type: NotificationType
}

export interface TeamMemberForm {
  name: string
  email: string
  password: string
  role: 'developer' | 'manager'
}

export interface MasterclassForm {
  title: string
  speaker: string
  description: string
  scheduled_at: string
  zoom_url: string
}
