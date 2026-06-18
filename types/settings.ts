// types/settings.ts

// ── Workspace ──
export interface WorkspaceSettings {
  id: string
  name: string
  logo_url: string | null
  timezone: string
  locale: string
  date_format: string
  time_format: string
  preferences: WorkspacePreferences
}

export interface WorkspacePreferences {
  show_order_data: boolean
  auto_translate: boolean
  allow_deletion: boolean
}

// ── Members ──
export type MemberRole = 'owner' | 'admin' | 'agent' | 'observer'

export interface Member {
  id: string
  user_id: string
  display_name: string | null
  email: string
  role: MemberRole
  avatar_url: string | null
  joined_at: string
  status: 'active' | 'pending'
}

export interface Invite {
  id: string
  email: string
  role: MemberRole
  created_at: string
  expires_at: string | null
  inviter_name?: string | null
  inviter_email?: string | null
  inviteLink?: string | null
}

export interface MembersPageData {
  members: Member[]
  invites: Invite[]
  currentUserRole: MemberRole | null
  isOwner: boolean
  workspaceName: string
  seatsUsed: number
  seatLimit: number | null
}

// ── Profile ──
export type Theme = 'system' | 'dark' | 'light'

export interface UserProfile {
  display_name: string
  bio: string
  email: string
  avatar_url: string | null
  theme: Theme
}

// ── Security ──
// Note: Password change and sign-out use Supabase Auth SDK directly
// (supabase.auth.updateUser, supabase.auth.signOut), NOT custom API routes.
// The current page shows device info via navigator.userAgent, not a sessions API.

export interface PasswordChangeForm {
  current_password: string
  new_password: string
  confirm_password: string
}

export interface MfaFactor {
  id: string
  type: 'totp'
  friendly_name: string | null
  created_at: string
  status: 'verified' | 'unverified'
}

// ── Macros ──
export interface MacroFilter {
  search: string
  language: string
  tags: string[]
  archived: boolean
}

export interface MacroOnboarding {
  brand_name: string
  brand_email: string
  brand_voice: string
  return_window: string
  return_shipping: string
  damage_policy: string
  extra_notes: string
  completed_at?: string | null
}

export interface MacroWizardStep {
  title: string
  description: string
}

export interface BrandVoice {
  value: string
  label: string
  description: string
}

// ── Tags ──
export interface Tag {
  id: string
  name: string
  color: string
  usage_count: number
}

export interface TagForm {
  name: string
  color: string
}

// ── Integrations ──
export type EmailProvider = 'gmail' | 'outlook' | 'custom' | 'forwarding'
export type ConnectionStatus = 'active' | 'pending' | 'error' | 'disconnected'

export interface EmailAccount {
  id: string
  provider: EmailProvider
  email: string
  status: ConnectionStatus
  connected_at: string | null
  last_sync_at: string | null
}

export interface CustomEmailConfig {
  email: string
  imap_host: string
  imap_port: number
  smtp_host: string
  smtp_port: number
  username: string
  password: string
  use_ssl: boolean
  store_id?: string
}

export interface ShopifyIntegration {
  domain: string | null
  status: ConnectionStatus
  connected_at: string | null
}

export interface EmailDisplaySettings {
  id: string
  workspace_id: string
  store_id: string | null
  email_account_id: string | null
  display_name: string | null
  closing_text: string | null
  signature_html: string | null
  logo_url: string | null
  logo_width: number
  logo_link_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}
