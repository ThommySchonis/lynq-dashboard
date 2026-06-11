// supabase/functions/api/lib/services/migrations/adapters/gorgias.ts

import type {
  SourceAdapter, SourceCredentials, SourceMailbox, TimeRange,
  Page, NormalizedTag, NormalizedMacro, NormalizedConversation,
} from '../types.ts'

const PAGE_LIMIT = 100

function authHeader(creds: SourceCredentials): string {
  const token = btoa(`${creds.username}:${creds.apiKey}`)
  return `Basic ${token}`
}

function baseUrl(creds: SourceCredentials): string {
  if (!creds.subdomain) throw new Error('Gorgias requires subdomain (e.g. brand.gorgias.com)')
  return `https://${creds.subdomain}`
}

async function gorgiasFetch(url: string, creds: SourceCredentials): Promise<unknown> {
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
      throw new Error(`Gorgias ${res.status}: ${body.slice(0, 200)}`)
    }
    return res.json()
  }
  throw new Error('Gorgias: rate limited after 3 attempts')
}

interface GorgiasListResp<T> { data: T[]; meta?: { next_page?: string | null } }
interface GorgiasChannel { id: number; type: string; address: string; name: string | null }
interface GorgiasTag { id: number; name: string; color: string | null }
interface GorgiasMacro { id: number; name: string; body_html: string; body_text: string | null }
interface GorgiasTicket {
  id: number
  channel: number
  subject: string | null
  customer: { email: string; name: string | null } | null
  status: 'open' | 'closed' | 'pending'
  tags: Array<{ id: number }>
  created_datetime: string
  updated_datetime: string
  messages: Array<{
    id: number
    from_agent: boolean
    sender: { email: string; name: string | null } | null
    body_html: string | null
    body_text: string | null
    created_datetime: string
  }>
}

export const gorgias: SourceAdapter = {
  platform: 'gorgias',

  async verifyCredentials(creds) {
    await gorgiasFetch(`${baseUrl(creds)}/api/account`, creds)
  },

  async listMailboxes(creds) {
    const resp = await gorgiasFetch(`${baseUrl(creds)}/api/channels`, creds) as GorgiasListResp<GorgiasChannel>
    return resp.data
      .filter((ch) => ch.type === 'email')
      .map((ch): SourceMailbox => ({
        source_id: String(ch.id),
        email: ch.address,
        display_name: ch.name,
      }))
  },

  async countAll(creds, range: TimeRange) {
    const url = `${baseUrl(creds)}/api/tickets/search?created_datetime__gte=${encodeURIComponent(range.start)}&created_datetime__lte=${encodeURIComponent(range.end)}&limit=1`
    const resp = await gorgiasFetch(url, creds) as { meta?: { total_count?: number } }
    const tagsResp = await gorgiasFetch(`${baseUrl(creds)}/api/tags?limit=1`, creds) as { meta?: { total_count?: number } }
    const macrosResp = await gorgiasFetch(`${baseUrl(creds)}/api/macros?limit=1`, creds) as { meta?: { total_count?: number } }
    return {
      tags: tagsResp.meta?.total_count ?? 0,
      macros: macrosResp.meta?.total_count ?? 0,
      conversations: resp.meta?.total_count ?? 0,
    }
  },

  async fetchTags(creds, cursor) {
    const url = cursor ?? `${baseUrl(creds)}/api/tags?limit=${PAGE_LIMIT}`
    const resp = await gorgiasFetch(url, creds) as GorgiasListResp<GorgiasTag>
    return {
      items: resp.data.map((t): NormalizedTag => ({
        source_external_id: String(t.id),
        name: t.name,
        color: t.color,
      })),
      nextCursor: resp.meta?.next_page ?? null,
    }
  },

  async fetchMacros(creds, cursor) {
    const url = cursor ?? `${baseUrl(creds)}/api/macros?limit=${PAGE_LIMIT}`
    const resp = await gorgiasFetch(url, creds) as GorgiasListResp<GorgiasMacro>
    return {
      items: resp.data.map((m): NormalizedMacro => ({
        source_external_id: String(m.id),
        name: m.name,
        body_html: m.body_html,
        body_text: m.body_text,
      })),
      nextCursor: resp.meta?.next_page ?? null,
    }
  },

  async fetchConversations(creds, range, mailboxIds, cursor) {
    const params = new URLSearchParams({
      limit: String(PAGE_LIMIT),
      created_datetime__gte: range.start,
      created_datetime__lte: range.end,
    })
    if (mailboxIds.length > 0) params.set('channel__in', mailboxIds.join(','))
    const url = cursor ?? `${baseUrl(creds)}/api/tickets?${params.toString()}`
    const resp = await gorgiasFetch(url, creds) as GorgiasListResp<GorgiasTicket>

    const items: NormalizedConversation[] = resp.data.map((t) => ({
      source_external_id: String(t.id),
      source_mailbox_id: String(t.channel),
      subject: t.subject,
      customer_email: t.customer?.email ?? 'unknown@unknown.local',
      customer_name: t.customer?.name ?? null,
      status: t.status,
      created_at: t.created_datetime,
      updated_at: t.updated_datetime,
      tag_external_ids: t.tags.map((tag) => String(tag.id)),
      messages: t.messages.map((m) => ({
        source_external_id: String(m.id),
        direction: m.from_agent ? 'outbound' : 'inbound',
        from_email: m.sender?.email ?? 'unknown@unknown.local',
        from_name: m.sender?.name ?? null,
        body_html: m.body_html ?? null,
        body_text: m.body_text ?? null,
        created_at: m.created_datetime,
      })),
    }))

    return { items, nextCursor: resp.meta?.next_page ?? null }
  },
}
