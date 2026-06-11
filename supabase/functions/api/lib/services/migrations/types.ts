// supabase/functions/api/lib/services/migrations/types.ts

export type SourcePlatform = 'gorgias' | 'zendesk' | 'reamaze' | 'commslayer'

export interface TimeRange {
  start: string  // ISO timestamp
  end: string    // ISO timestamp
}

export interface SourceCredentials {
  authMethod: 'oauth' | 'api_key'
  subdomain?: string             // e.g. brand.zendesk.com
  accessToken?: string           // OAuth bearer or API token
  apiKey?: string                // some platforms use email + api_key basic auth
  username?: string
}

export interface SourceMailbox {
  source_id: string
  email: string
  display_name: string | null
}

export interface NormalizedTag {
  source_external_id: string
  name: string
  color: string | null
}

export interface NormalizedMacro {
  source_external_id: string
  name: string
  body_html: string
  body_text: string | null
}

export interface NormalizedMessage {
  source_external_id: string
  direction: 'inbound' | 'outbound'
  from_email: string
  from_name: string | null
  body_html: string | null
  body_text: string | null
  created_at: string
}

export interface NormalizedConversation {
  source_external_id: string
  source_mailbox_id: string
  subject: string | null
  customer_email: string
  customer_name: string | null
  status: 'open' | 'closed' | 'pending'
  created_at: string
  updated_at: string
  tag_external_ids: string[]
  messages: NormalizedMessage[]
}

export interface Page<T> {
  items: T[]
  nextCursor: string | null
}

export interface SourceAdapter {
  readonly platform: SourcePlatform
  verifyCredentials(creds: SourceCredentials): Promise<void>
  listMailboxes(creds: SourceCredentials): Promise<SourceMailbox[]>
  countAll(creds: SourceCredentials, range: TimeRange): Promise<{
    tags: number
    macros: number
    conversations: number
  }>
  fetchTags(creds: SourceCredentials, cursor: string | null): Promise<Page<NormalizedTag>>
  fetchMacros(creds: SourceCredentials, cursor: string | null): Promise<Page<NormalizedMacro>>
  fetchConversations(
    creds: SourceCredentials,
    range: TimeRange,
    mailboxIds: string[],
    cursor: string | null,
  ): Promise<Page<NormalizedConversation>>
}

// Job state pulled from `workspace_migrations`. Orchestrator-internal type.
export interface MigrationJob {
  id: string
  workspace_id: string
  source_platform: SourcePlatform
  credentials_ref: string | null
  phase: 'tags' | 'macros' | 'conversations' | null
  time_range_start: string | null
  time_range_end: string | null
  mailbox_links: Record<string, string>      // source_id → email_account_id
  cursor: { tags?: string; macros?: string; conversations?: string }
  progress: {
    tags?: { done: number; total: number }
    macros?: { done: number; total: number }
    conversations?: { done: number; total: number }
  }
}
