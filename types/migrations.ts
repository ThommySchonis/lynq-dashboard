// types/migrations.ts

export type SourcePlatform = 'gorgias' | 'zendesk' | 'reamaze' | 'commslayer'

export type MigrationStatus =
  | 'draft' | 'ready' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface Migration {
  id: string
  workspace_id: string
  source_platform: SourcePlatform
  source_subdomain: string | null
  auth_method: 'oauth' | 'api_key'
  credentials_ref: string | null
  status: MigrationStatus
  phase: 'tags' | 'macros' | 'conversations' | null
  time_range_start: string | null
  time_range_end: string | null
  mailbox_links: Record<string, string>
  progress: {
    tags?: { done: number; total: number }
    macros?: { done: number; total: number }
    conversations?: { done: number; total: number }
  }
  error: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface SourceMailbox {
  source_id: string
  email: string
  display_name: string | null
}
