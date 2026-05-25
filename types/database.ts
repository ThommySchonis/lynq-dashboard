export interface Client {
  id: string
  company_name: string
  email: string
  shopify_domain: string | null
  shopify_api_key: string | null
  gorgias_domain: string | null
  gorgias_api_key: string | null
  parcel_panel_api_key: string | null
  status: 'active' | 'inactive' | 'trial'
  created_at: string
}

export interface Broadcast {
  id: string
  title: string
  body: string
  type: 'update' | 'tip' | 'video' | 'industry'
  created_at: string
  workspace_id: string
}

export interface Notification {
  id: string
  title: string
  body: string
  type: 'info' | 'warn' | 'danger'
  created_at: string
  workspace_id: string
}

export interface Workspace {
  id: string
  name: string
  slug: string
  logo_url: string | null
  plan: string
  trial_ends_at: string | null
  created_at: string
  suspended_at: string | null
  suspension_reason: string | null
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: Role
  display_name: string | null
  avatar_url: string | null
  created_at: string
}

export type Role = 'owner' | 'admin' | 'agent' | 'observer'

export interface OwnershipTransfer {
  id: string
  workspace_id: string
  from_user_id: string
  to_user_id: string
  new_role_for_old_owner: string
  status: string
  created_at: string
  expires_at: string
  resolved_at: string | null
}

export interface AccountDeletionLog {
  id: string
  user_id: string
  user_email: string
  event: 'scheduled' | 'cancelled' | 'deleted' | 'error'
  metadata: Record<string, unknown>
  created_at: string
}

export interface AnonymizedMember {
  id: string
  workspace_id: string
  original_user_id: string
  anonymized_at: string
}
