// PostgREST `.or()` uses commas to separate predicates and treats % / _ as
// ILIKE wildcards. Escape both, plus backslash and the comma itself, so the
// user's literal characters are matched and the filter expression stays valid.
export function escapeForOrFilter(input: string): string {
  return input
    .trim()
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/,/g, '\\,')
}

// Build a short, context-rich snippet of `text` centered on `query`'s first
// match. Returns '' for null/empty input. Whitespace is collapsed so multi-line
// HTML/text bodies render cleanly in a single-line UI row.
export function makeSnippet(
  text: string | null | undefined,
  query: string,
  maxLength: number,
): string {
  if (!text) return ''
  const collapsed = text.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= maxLength) return collapsed

  const idx = query
    ? collapsed.toLowerCase().indexOf(query.toLowerCase())
    : -1
  const half = Math.floor(maxLength / 2)

  if (idx === -1) {
    return collapsed.slice(0, maxLength) + '…'
  }

  const start = Math.max(0, idx - half)
  const end = Math.min(collapsed.length, idx + query.length + half)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < collapsed.length ? '…' : ''
  return prefix + collapsed.slice(start, end) + suffix
}

export interface ContactRow {
  customer_email: string | null
  customer_name: string | null
  last_message_at: string | null
}

export interface ContactGroup {
  email: string
  name: string | null
  last_message_at: string | null
  conversation_count: number
}

// Deduplicate raw `email_conversations` rows by lowercased email and return
// the top `limit` groups ordered by newest `last_message_at`. The newest row's
// non-empty name wins, ties broken by insertion order.
export function groupContactsByEmail(
  rows: ContactRow[],
  limit: number,
): ContactGroup[] {
  const byEmail = new Map<string, ContactGroup>()

  for (const row of rows) {
    const email = (row.customer_email ?? '').trim()
    if (!email) continue
    const key = email.toLowerCase()
    const existing = byEmail.get(key)

    if (!existing) {
      byEmail.set(key, {
        email: key,
        name: row.customer_name ?? null,
        last_message_at: row.last_message_at,
        conversation_count: 1,
      })
      continue
    }

    existing.conversation_count++
    if ((row.last_message_at ?? '') > (existing.last_message_at ?? '')) {
      existing.last_message_at = row.last_message_at
      if (row.customer_name) existing.name = row.customer_name
    }
  }

  return Array.from(byEmail.values())
    .sort((a, b) => (b.last_message_at ?? '').localeCompare(a.last_message_at ?? ''))
    .slice(0, limit)
}

import type { SupabaseClient } from '@supabase/supabase-js'

export type SearchType = 'conversations' | 'messages' | 'contacts'

export interface ConversationResult {
  id: string
  subject: string | null
  snippet: string | null
  customer_email: string | null
  customer_name: string | null
  last_message_at: string | null
  status: string | null
}

export interface MessageResult {
  id: string
  conversation_id: string
  snippet: string
  from_email: string | null
  from_name: string | null
  is_outbound: boolean
  created_at: string | null
}

export interface SearchResult {
  conversations?: ConversationResult[]
  messages?: MessageResult[]
  contacts?: ContactGroup[]
}

const MESSAGE_SNIPPET_MAX = 200

export async function searchConversations(
  sb: SupabaseClient,
  workspaceId: string,
  q: string,
  limit: number,
): Promise<ConversationResult[]> {
  const safe = escapeForOrFilter(q)
  const { data, error } = await sb
    .from('email_conversations')
    .select('id, subject, snippet, customer_email, customer_name, last_message_at, status')
    .eq('workspace_id', workspaceId)
    .or(
      `subject.ilike.%${safe}%,snippet.ilike.%${safe}%,` +
      `customer_email.ilike.%${safe}%,customer_name.ilike.%${safe}%`,
    )
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as ConversationResult[]
}

export async function searchMessages(
  sb: SupabaseClient,
  workspaceId: string,
  q: string,
  limit: number,
): Promise<MessageResult[]> {
  const safe = escapeForOrFilter(q)
  const { data, error } = await sb
    .from('email_messages')
    .select('id, conversation_id, body_text, from_email, from_name, is_outbound, created_at')
    .eq('workspace_id', workspaceId)
    .or(
      `body_text.ilike.%${safe}%,from_email.ilike.%${safe}%,from_name.ilike.%${safe}%`,
    )
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (error) throw error

  return (data ?? []).map((row): MessageResult => ({
    id: row.id,
    conversation_id: row.conversation_id,
    snippet: makeSnippet(row.body_text, q, MESSAGE_SNIPPET_MAX),
    from_email: row.from_email,
    from_name: row.from_name,
    is_outbound: row.is_outbound,
    created_at: row.created_at,
  }))
}

export async function searchContacts(
  sb: SupabaseClient,
  workspaceId: string,
  q: string,
  limit: number,
): Promise<ContactGroup[]> {
  const safe = escapeForOrFilter(q)
  // Over-fetch so the client-side dedupe still has `limit` distinct groups.
  const fetchLimit = limit * 4
  const { data, error } = await sb
    .from('email_conversations')
    .select('customer_email, customer_name, last_message_at')
    .eq('workspace_id', workspaceId)
    .or(`customer_email.ilike.%${safe}%,customer_name.ilike.%${safe}%`)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(fetchLimit)
  if (error) throw error
  return groupContactsByEmail((data ?? []) as ContactRow[], limit)
}

export interface SearchParams {
  q: string
  types: SearchType[]
  limit: number
}

export async function searchService(
  sb: SupabaseClient,
  workspaceId: string,
  { q, types, limit }: SearchParams,
): Promise<SearchResult> {
  const wants = new Set(types)
  const [conversations, messages, contacts] = await Promise.all([
    wants.has('conversations') ? searchConversations(sb, workspaceId, q, limit) : Promise.resolve(undefined),
    wants.has('messages')      ? searchMessages(sb, workspaceId, q, limit)      : Promise.resolve(undefined),
    wants.has('contacts')      ? searchContacts(sb, workspaceId, q, limit)      : Promise.resolve(undefined),
  ])
  const result: SearchResult = {}
  if (conversations !== undefined) result.conversations = conversations
  if (messages !== undefined) result.messages = messages
  if (contacts !== undefined) result.contacts = contacts
  return result
}
