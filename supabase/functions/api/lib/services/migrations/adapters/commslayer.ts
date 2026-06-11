// supabase/functions/api/lib/services/migrations/adapters/commslayer.ts

import type {
  SourceAdapter, SourceCredentials, SourceMailbox, TimeRange,
  Page, NormalizedTag, NormalizedMacro, NormalizedConversation, NormalizedMessage,
} from '../types.ts'

const BASE_URL = 'https://app.commslayer.com/api/integration/v1'
const PAGE_LIMIT = 100

function authHeader(creds: SourceCredentials): string {
  return `Bearer ${creds.accessToken}`
}

async function commslayerFetch(url: string, creds: SourceCredentials): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      headers: { 'Authorization': authHeader(creds), 'Accept': 'application/json' },
    })
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '1', 10)
      await new Promise((r) => setTimeout(r, Math.max(0, retryAfter) * 1000))
      continue
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`CommSlayer ${res.status}: ${body.slice(0, 200)}`)
    }
    return res.json()
  }
  throw new Error('CommSlayer: rate limited after 3 attempts')
}

// ---------- raw API shapes ----------

interface CsConversation {
  id: number
  inbox_id: number
  contact_id: number
  status: string
  labels: string[]
  created_at: string
  updated_at: string
}

interface CsConversationsResp {
  data: CsConversation[]
  meta: { next_cursor: string | null }
}

interface CsLabel {
  id: number
  title: string
  color: string | null
}

interface CsLabelsResp {
  data: CsLabel[]
  meta: { next_cursor: string | null }
}

interface CsMessage {
  id: number
  conversation_id: number
  content: string
  message_type: string
  private: boolean
  sender_type: string | null
  sender_id: number | null
  created_at: string
  updated_at: string
}

interface CsMessagesResp {
  data: CsMessage[]
  meta: { next_cursor: string | null }
}

interface CsContact {
  id: number
  name: string
  email: string
}

interface CsContactResp {
  data: CsContact
}

// ---------- helpers ----------

function mapStatus(status: string): NormalizedConversation['status'] {
  if (status === 'open') return 'open'
  if (status === 'pending') return 'pending'
  return 'closed'  // resolved, snoozed → closed
}

interface InboxCursor { inboxIdx: number; after: string | null }
interface SimpleCursor { after: string | null }

function parseConvCursor(
  cursor: string | null,
  mailboxIds: string[],
): InboxCursor | SimpleCursor {
  if (cursor === null) {
    if (mailboxIds.length > 0) return { inboxIdx: 0, after: null }
    return { after: null }
  }
  try {
    return JSON.parse(cursor) as InboxCursor | SimpleCursor
  } catch {
    return mailboxIds.length > 0 ? { inboxIdx: 0, after: null } : { after: null }
  }
}

// ---------- adapter ----------

export const commslayer: SourceAdapter = {
  platform: 'commslayer',

  async verifyCredentials(creds) {
    await commslayerFetch(`${BASE_URL}/conversations?page[limit]=1`, creds)
  },

  async listMailboxes(creds) {
    const seen = new Map<number, SourceMailbox>()
    let after: string | null = null
    let pages = 0

    while (pages < 3) {
      const params = new URLSearchParams({ 'page[limit]': String(PAGE_LIMIT) })
      if (after) params.set('page[after]', after)
      const resp = await commslayerFetch(
        `${BASE_URL}/conversations?${params.toString()}`,
        creds,
      ) as CsConversationsResp

      for (const conv of resp.data) {
        if (!seen.has(conv.inbox_id)) {
          seen.set(conv.inbox_id, {
            source_id: String(conv.inbox_id),
            email: `inbox-${conv.inbox_id}@commslayer.local`,
            display_name: `Inbox #${conv.inbox_id}`,
          })
        }
      }

      after = resp.meta.next_cursor
      pages++
      if (!after) break
    }

    return Array.from(seen.values())
  },

  async countAll(_creds, _range: TimeRange) {
    // CommSlayer doesn't expose counts — return zeros
    return { tags: 0, macros: 0, conversations: 0 }
  },

  async fetchTags(creds, cursor) {
    const params = new URLSearchParams({ 'page[limit]': String(PAGE_LIMIT) })
    if (cursor) params.set('page[after]', cursor)
    const resp = await commslayerFetch(`${BASE_URL}/labels?${params.toString()}`, creds) as CsLabelsResp
    return {
      items: resp.data.map((l): NormalizedTag => ({
        source_external_id: String(l.id),
        name: l.title,
        color: l.color ?? null,
      })),
      nextCursor: resp.meta.next_cursor ?? null,
    }
  },

  async fetchMacros(_creds, _cursor) {
    // CommSlayer has no macros endpoint
    return { items: [], nextCursor: null }
  },

  async fetchConversations(creds, _range, mailboxIds, cursor) {
    const parsed = parseConvCursor(cursor, mailboxIds)
    const hasMailboxes = mailboxIds.length > 0

    let after: string | null
    let inboxIdx: number | undefined

    if (hasMailboxes) {
      const c = parsed as InboxCursor
      inboxIdx = c.inboxIdx ?? 0
      after = c.after ?? null
    } else {
      after = (parsed as SimpleCursor).after ?? null
    }

    const params = new URLSearchParams({ 'page[limit]': String(PAGE_LIMIT) })
    if (after) params.set('page[after]', after)
    if (hasMailboxes && inboxIdx !== undefined) {
      params.set('filter[inbox_id]', mailboxIds[inboxIdx])
    }

    const resp = await commslayerFetch(
      `${BASE_URL}/conversations?${params.toString()}`,
      creds,
    ) as CsConversationsResp

    // Collect unique contact IDs and fetch them
    const contactIds = new Set<number>(resp.data.map((c) => c.contact_id))
    const contactMap = new Map<number, CsContact>()
    for (const cid of contactIds) {
      const contactResp = await commslayerFetch(`${BASE_URL}/contacts/${cid}`, creds) as CsContactResp
      contactMap.set(cid, contactResp.data)
    }

    const items: NormalizedConversation[] = []
    for (const conv of resp.data) {
      // Fetch messages for this conversation
      const msgsResp = await commslayerFetch(
        `${BASE_URL}/conversations/${conv.id}/messages?page[limit]=${PAGE_LIMIT}`,
        creds,
      ) as CsMessagesResp

      const messages: NormalizedMessage[] = []
      for (const msg of msgsResp.data) {
        // Skip private (internal notes) and non-customer-facing types
        if (msg.private) continue
        if (msg.message_type !== 'incoming' && msg.message_type !== 'outgoing') continue

        const direction: 'inbound' | 'outbound' =
          msg.message_type === 'incoming' ? 'inbound' : 'outbound'

        messages.push({
          source_external_id: String(msg.id),
          direction,
          from_email: msg.message_type === 'incoming'
            ? (contactMap.get(conv.contact_id)?.email ?? 'unknown@unknown.local')
            : 'agent@commslayer.local',
          from_name: msg.message_type === 'incoming'
            ? (contactMap.get(conv.contact_id)?.name ?? null)
            : null,
          body_html: null,
          body_text: msg.content,
          created_at: msg.created_at,
        })
      }

      const contact = contactMap.get(conv.contact_id)

      items.push({
        source_external_id: String(conv.id),
        source_mailbox_id: String(conv.inbox_id),
        subject: null,
        customer_email: contact?.email ?? 'unknown@unknown.local',
        customer_name: contact?.name ?? null,
        status: mapStatus(conv.status),
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        tag_external_ids: conv.labels,
        messages,
      })
    }

    // Determine next cursor
    let nextCursor: string | null = null
    const nextAfter = resp.meta.next_cursor ?? null

    if (hasMailboxes) {
      const curIdx = inboxIdx!
      if (nextAfter) {
        nextCursor = JSON.stringify({ inboxIdx: curIdx, after: nextAfter })
      } else if (curIdx + 1 < mailboxIds.length) {
        nextCursor = JSON.stringify({ inboxIdx: curIdx + 1, after: null })
      }
      // else: all inboxes exhausted → null
    } else {
      nextCursor = nextAfter ? JSON.stringify({ after: nextAfter }) : null
    }

    return { items, nextCursor }
  },
}
