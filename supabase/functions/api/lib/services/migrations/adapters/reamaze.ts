// supabase/functions/api/lib/services/migrations/adapters/reamaze.ts

import type {
  NormalizedConversation,
  NormalizedMacro,
  NormalizedMessage,
  NormalizedTag,
  SourceAdapter, SourceCredentials, SourceMailbox, TimeRange
} from '../types.ts'

function authHeader(creds: SourceCredentials): string {
  const token = btoa(`${creds.username}:${creds.apiKey}`)
  return `Basic ${token}`
}

function baseUrl(creds: SourceCredentials): string {
  if (!creds.subdomain) throw new Error('Re:amaze requires subdomain')
  const host = creds.subdomain.includes('.') ? creds.subdomain : `${creds.subdomain}.reamaze.io`
  return `https://${host}/api/v1`
}

async function reamazeFetch(url: string, creds: SourceCredentials): Promise<unknown> {
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
      throw new Error(`Re:amaze ${res.status}: ${body.slice(0, 200)}`)
    }
    return res.json()
  }
  throw new Error('Re:amaze: rate limited after 3 attempts')
}

// ---------- raw API shapes ----------

interface ReamazeChannel {
  slug: string
  name: string
  email: string | null
  channel: number
}

interface ReamazeChannelsResp {
  channels: ReamazeChannel[]
  page_size: number
  page_count: number
  total_count: number
}

interface ReamazeTemplate {
  slug: string
  name: string
  body: string
}

interface ReamazeTemplatesResp {
  response_templates: ReamazeTemplate[]
  page_size: number
  page_count: number
  total_count: number
}

interface ReamazeConversation {
  slug: string
  subject: string | null
  status: number
  tag_list: string[]
  author: { email: string; name: string }
  category: { slug: string; name: string; channel: number } | null
  created_at: string
  updated_at: string
}

interface ReamazeConversationsResp {
  conversations: ReamazeConversation[]
  page_size: number
  page_count: number
  total_count: number
}

interface ReamazeMessage {
  body: string
  visibility: number
  origin: number
  created_at: string
  user: { email: string; name: string }
}

interface ReamazeMessagesResp {
  messages: ReamazeMessage[]
  page_size: number
  page_count: number
  total_count: number
}

// ---------- helpers ----------

function mapStatus(status: number): NormalizedConversation['status'] {
  if (status === 0 || status === 1) return 'open'
  if (status === 5 || status === 7) return 'pending'
  return 'closed'
}

interface ConvCursor { mailboxIdx: number; page: number }
interface SimpleCursor { page: number }

function parseConvCursor(cursor: string | null, mailboxIds: string[]): ConvCursor | SimpleCursor {
  if (cursor === null) {
    if (mailboxIds.length > 0) return { mailboxIdx: 0, page: 1 }
    return { page: 1 }
  }
  try {
    return JSON.parse(cursor) as ConvCursor | SimpleCursor
  } catch {
    return mailboxIds.length > 0 ? { mailboxIdx: 0, page: 1 } : { page: 1 }
  }
}

// ---------- adapter ----------

export const reamaze: SourceAdapter = {
  platform: 'reamaze',

  async verifyCredentials(creds) {
    await reamazeFetch(`${baseUrl(creds)}/channels?page=1`, creds)
  },

  async listMailboxes(creds) {
    const mailboxes: SourceMailbox[] = []
    let page = 1
    while (true) {
      const resp = await reamazeFetch(`${baseUrl(creds)}/channels?page=${page}`, creds) as ReamazeChannelsResp
      for (const ch of resp.channels) {
        if (ch.channel === 1 && ch.email) {
          mailboxes.push({
            source_id: ch.slug,
            email: ch.email,
            display_name: ch.name,
          })
        }
      }
      if (page >= resp.page_count) break
      page++
    }
    return mailboxes
  },

  async countAll(creds, range: TimeRange) {
    const templatesResp = await reamazeFetch(
      `${baseUrl(creds)}/response_templates?page=1`,
      creds,
    ) as ReamazeTemplatesResp
    const convResp = await reamazeFetch(
      `${baseUrl(creds)}/conversations?page=1&start_date=${encodeURIComponent(range.start)}&end_date=${encodeURIComponent(range.end)}`,
      creds,
    ) as ReamazeConversationsResp
    return {
      tags: 0,
      macros: templatesResp.total_count,
      conversations: convResp.total_count,
    }
  },

  async fetchTags(creds, cursor) {
    // Re:amaze has no /tags endpoint. On the first (and only) call, scan one page of
    // conversations to harvest tag_list strings and emit them as NormalizedTag rows.
    // Always return nextCursor: null so only one call is ever made.
    if (cursor !== null) {
      return { items: [], nextCursor: null }
    }
    const resp = await reamazeFetch(`${baseUrl(creds)}/conversations?page=1`, creds) as ReamazeConversationsResp
    const seen = new Set<string>()
    const items: NormalizedTag[] = []
    for (const conv of resp.conversations) {
      for (const tag of conv.tag_list) {
        if (!seen.has(tag)) {
          seen.add(tag)
          items.push({ source_external_id: tag, name: tag, color: null })
        }
      }
    }
    return { items, nextCursor: null }
  },

  async fetchMacros(creds, cursor) {
    const page = cursor ? parseInt(cursor, 10) : 1
    const resp = await reamazeFetch(`${baseUrl(creds)}/response_templates?page=${page}`, creds) as ReamazeTemplatesResp
    const nextCursor = page < resp.page_count ? String(page + 1) : null
    return {
      items: resp.response_templates.map((t): NormalizedMacro => ({
        source_external_id: t.slug,
        name: t.name,
        body_html: t.body,
        body_text: null,
      })),
      nextCursor,
    }
  },

  async fetchConversations(creds, range, mailboxIds, cursor) {
    const parsed = parseConvCursor(cursor, mailboxIds)
    const hasMailboxes = mailboxIds.length > 0

    let page: number
    let mailboxIdx: number | undefined
    let category: string | undefined

    if (hasMailboxes) {
      const c = parsed as ConvCursor
      mailboxIdx = c.mailboxIdx ?? 0
      page = c.page ?? 1
      category = mailboxIds[mailboxIdx]
    } else {
      page = (parsed as SimpleCursor).page ?? 1
    }

    const params = new URLSearchParams({
      page: String(page),
      start_date: range.start,
      end_date: range.end,
    })
    if (category) params.set('category', category)

    const resp = await reamazeFetch(
      `${baseUrl(creds)}/conversations?${params.toString()}`,
      creds,
    ) as ReamazeConversationsResp

    const items: NormalizedConversation[] = []
    for (const conv of resp.conversations) {
      // Fetch messages for this conversation
      const msgsResp = await reamazeFetch(
        `${baseUrl(creds)}/conversations/${conv.slug}/messages?page=1`,
        creds,
      ) as ReamazeMessagesResp

      const messages: NormalizedMessage[] = []
      let msgIdx = 0
      for (const msg of msgsResp.messages) {
        if (msg.visibility !== 0) continue  // skip internal notes
        const direction: 'inbound' | 'outbound' =
          msg.user.email.toLowerCase() === conv.author.email.toLowerCase() ? 'inbound' : 'outbound'
        messages.push({
          source_external_id: `${conv.slug}-msg-${msgIdx++}`,
          direction,
          from_email: msg.user.email,
          from_name: msg.user.name,
          body_html: msg.body,
          body_text: null,
          created_at: msg.created_at,
        })
      }

      items.push({
        source_external_id: conv.slug,
        source_mailbox_id: conv.category?.slug ?? '',
        subject: conv.subject,
        customer_email: conv.author.email,
        customer_name: conv.author.name,
        status: mapStatus(conv.status),
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        tag_external_ids: conv.tag_list,
        messages,
      })
    }

    // Determine next cursor
    let nextCursor: string | null = null
    if (hasMailboxes) {
      const curMailboxIdx = mailboxIdx!
      if (page < resp.page_count) {
        // More pages for current mailbox
        nextCursor = JSON.stringify({ mailboxIdx: curMailboxIdx, page: page + 1 })
      } else if (curMailboxIdx + 1 < mailboxIds.length) {
        // Move to next mailbox
        nextCursor = JSON.stringify({ mailboxIdx: curMailboxIdx + 1, page: 1 })
      }
      // else: all mailboxes exhausted → null
    } else {
      nextCursor = page < resp.page_count ? JSON.stringify({ page: page + 1 }) : null
    }

    return { items, nextCursor }
  },
}
