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

export interface SearchParams {
  q: string
  types: SearchType[]
  filters: SearchFilters
  limit: number
}

interface ApiSearchRow {
  conversations: ConversationResult[]
  messages: Array<{
    id: string
    conversation_id: string
    body_text: string | null
    from_email: string | null
    from_name: string | null
    is_outbound: boolean
    created_at: string | null
  }>
  contacts: ContactRow[]
}

export async function searchService(
  sb: SupabaseClient,
  workspaceId: string,
  { q, types, filters, limit }: SearchParams,
): Promise<SearchResult> {
  const { data, error } = await sb.rpc('api_search', {
    p_workspace_id: workspaceId,
    p_q: q || null,
    p_types: types,
    p_status: filters.status,
    p_assignee: filters.assignee,
    p_date_from: filters.dateFrom,
    p_date_to: filters.dateTo,
    p_limit: limit,
  })
  if (error) throw error

  const row = data as ApiSearchRow
  const wants = new Set(types)
  const result: SearchResult = {}

  if (wants.has('conversations')) {
    result.conversations = row.conversations ?? []
  }
  if (wants.has('messages')) {
    result.messages = (row.messages ?? []).map((m): MessageResult => ({
      id: m.id,
      conversation_id: m.conversation_id,
      snippet: makeSnippet(m.body_text, q, MESSAGE_SNIPPET_MAX),
      from_email: m.from_email,
      from_name: m.from_name,
      is_outbound: m.is_outbound,
      created_at: m.created_at,
    }))
  }
  if (wants.has('contacts')) {
    result.contacts = groupContactsByEmail(row.contacts ?? [], limit)
  }
  return result
}

// ---------------------------------------------------------------------------
// Filter param parsing
// ---------------------------------------------------------------------------

export type StatusFilterValue = 'open' | 'pending' | 'resolved' | 'ai_staged' | 'spam'
const ALLOWED_STATUSES: StatusFilterValue[] = ['open', 'pending', 'resolved', 'ai_staged', 'spam']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface SearchFilters {
  status: StatusFilterValue[]
  assignee: string[] // uuids + 'unassigned'
  dateFrom: string | null
  dateTo: string | null
}

export interface ParseFilterResult {
  filters?: SearchFilters
  error?: string
}

function splitList(raw: string | undefined): string[] {
  if (!raw) return []
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

export function parseFilterParams(params: {
  status?: string
  assignee?: string
  dateFrom?: string
  dateTo?: string
}): ParseFilterResult {
  const status = splitList(params.status)
  for (const s of status) {
    if (!(ALLOWED_STATUSES as string[]).includes(s)) {
      return { error: `invalid status: ${s}` }
    }
  }

  const assignee = splitList(params.assignee)
  for (const a of assignee) {
    if (a !== 'unassigned' && !UUID_RE.test(a)) {
      return { error: `invalid assignee: ${a}` }
    }
  }

  function parseDate(raw: string | undefined, label: string): { value: string | null; error?: string } {
    if (!raw) return { value: null }
    const ts = Date.parse(raw)
    if (Number.isNaN(ts)) return { value: null, error: `invalid ${label}` }
    return { value: raw }
  }

  const from = parseDate(params.dateFrom, 'dateFrom')
  if (from.error) return { error: from.error }
  const to = parseDate(params.dateTo, 'dateTo')
  if (to.error) return { error: to.error }

  return {
    filters: {
      status: status as StatusFilterValue[],
      assignee,
      dateFrom: from.value,
      dateTo: to.value,
    },
  }
}
