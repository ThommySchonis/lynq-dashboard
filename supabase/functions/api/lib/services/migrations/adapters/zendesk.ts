// supabase/functions/api/lib/services/migrations/adapters/zendesk.ts

import type {
  SourceAdapter, SourceCredentials, SourceMailbox, TimeRange,
  Page, NormalizedTag, NormalizedMacro, NormalizedConversation, NormalizedMessage,
} from '../types.ts'

const PAGE_LIMIT = 100

function authHeader(creds: SourceCredentials): string {
  if (creds.authMethod === 'oauth') return `Bearer ${creds.accessToken}`
  const token = btoa(`${creds.username}/token:${creds.apiKey}`)
  return `Basic ${token}`
}

function baseUrl(creds: SourceCredentials): string {
  if (!creds.subdomain) throw new Error('Zendesk requires subdomain')
  return `https://${creds.subdomain}.zendesk.com/api/v2`
}

async function zendeskFetch(url: string, creds: SourceCredentials): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { 'Authorization': authHeader(creds), 'Accept': 'application/json' } })
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '1', 10)
      await new Promise((r) => setTimeout(r, Math.max(0, retryAfter) * 1000))
      continue
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Zendesk ${res.status}: ${body.slice(0, 200)}`)
    }
    return res.json()
  }
  throw new Error('Zendesk: rate limited after 3 attempts')
}

interface ZdBrand { id: number; name: string; subdomain: string; active: boolean; default: boolean }
interface ZdTag { name: string; count: number }
interface ZdMacro { id: number; title: string; actions: Array<{ field: string; value: string }> }
interface ZdTicket {
  id: number; subject: string | null; brand_id: number | null; requester_id: number; status: string;
  tags: string[]; created_at: string; updated_at: string
}
interface ZdComment {
  id: number; author_id: number; html_body: string | null; body: string | null; created_at: string; public: boolean
}
interface ZdUser { id: number; email: string | null; name: string | null; role: string }

export const zendesk: SourceAdapter = {
  platform: 'zendesk',

  async verifyCredentials(creds) {
    await zendeskFetch(`${baseUrl(creds)}/users/me.json`, creds)
  },

  async listMailboxes(creds) {
    const resp = await zendeskFetch(`${baseUrl(creds)}/brands.json`, creds) as { brands: ZdBrand[] }
    return resp.brands
      .filter((b) => b.active)
      .map((b): SourceMailbox => ({
        source_id: String(b.id),
        email: `${b.subdomain}@zendesk-brand.local`,
        display_name: b.name,
      }))
  },

  async countAll(creds, range: TimeRange) {
    const countTickets = await zendeskFetch(
      `${baseUrl(creds)}/search/count.json?query=${encodeURIComponent(`type:ticket created>=${range.start} created<=${range.end}`)}`,
      creds,
    ) as { count: { value: number } }
    return {
      tags: 0,
      macros: 0,
      conversations: countTickets.count.value ?? 0,
    }
  },

  async fetchTags(creds, cursor) {
    const url = cursor ?? `${baseUrl(creds)}/tags.json?page[size]=${PAGE_LIMIT}`
    const resp = await zendeskFetch(url, creds) as { tags: ZdTag[]; next_page: string | null }
    return {
      items: resp.tags.map((t): NormalizedTag => ({
        source_external_id: t.name,
        name: t.name,
        color: null,
      })),
      nextCursor: resp.next_page ?? null,
    }
  },

  async fetchMacros(creds, cursor) {
    const url = cursor ?? `${baseUrl(creds)}/macros.json?page[size]=${PAGE_LIMIT}`
    const resp = await zendeskFetch(url, creds) as { macros: ZdMacro[]; next_page: string | null }
    return {
      items: resp.macros.map((m): NormalizedMacro => {
        const htmlAction = m.actions.find((a) => a.field === 'comment_value_html')
        const textAction = m.actions.find((a) => a.field === 'comment_value')
        return {
          source_external_id: String(m.id),
          name: m.title,
          body_html: htmlAction?.value ?? '',
          body_text: textAction?.value ?? null,
        }
      }),
      nextCursor: resp.next_page ?? null,
    }
  },

  async fetchConversations(creds, range, mailboxIds, cursor) {
    const params = new URLSearchParams({
      'page[size]': String(PAGE_LIMIT),
      'sort_by': 'created_at',
      'created_at[gte]': range.start,
      'created_at[lte]': range.end,
    })
    if (mailboxIds.length > 0) params.set('brand_id', mailboxIds[0])
    const url = cursor ?? `${baseUrl(creds)}/tickets.json?${params.toString()}`
    const resp = await zendeskFetch(url, creds) as { tickets?: ZdTicket[]; results?: ZdTicket[]; next_page: string | null }
    const tickets = resp.tickets ?? resp.results ?? []

    if (tickets.length === 0) return { items: [], nextCursor: resp.next_page ?? null }

    const ticketsWithComments: Array<{ ticket: ZdTicket; comments: ZdComment[] }> = []
    for (const t of tickets) {
      const cResp = await zendeskFetch(`${baseUrl(creds)}/tickets/${t.id}/comments.json`, creds) as { comments: ZdComment[] }
      ticketsWithComments.push({ ticket: t, comments: cResp.comments })
    }

    const userIds = new Set<number>()
    for (const tc of ticketsWithComments) {
      userIds.add(tc.ticket.requester_id)
      for (const c of tc.comments) userIds.add(c.author_id)
    }
    const usersResp = await zendeskFetch(
      `${baseUrl(creds)}/users/show_many.json?ids=${Array.from(userIds).join(',')}`,
      creds,
    ) as { users: ZdUser[] }
    const userById = new Map<number, ZdUser>(usersResp.users.map((u) => [u.id, u]))

    const items: NormalizedConversation[] = ticketsWithComments.map(({ ticket, comments }) => {
      const requester = userById.get(ticket.requester_id)
      const messages: NormalizedMessage[] = comments.map((cm) => {
        const author = userById.get(cm.author_id)
        return {
          source_external_id: String(cm.id),
          direction: author?.role === 'end-user' ? 'inbound' : 'outbound',
          from_email: author?.email ?? 'unknown@unknown.local',
          from_name: author?.name ?? null,
          body_html: cm.html_body,
          body_text: cm.body,
          created_at: cm.created_at,
        }
      })
      const status: NormalizedConversation['status'] =
        ticket.status === 'open' || ticket.status === 'new' ? 'open'
        : ticket.status === 'pending' ? 'pending'
        : 'closed'
      return {
        source_external_id: String(ticket.id),
        source_mailbox_id: String(ticket.brand_id ?? ''),
        subject: ticket.subject,
        customer_email: requester?.email ?? 'unknown@unknown.local',
        customer_name: requester?.name ?? null,
        status,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at,
        tag_external_ids: ticket.tags,
        messages,
      }
    })

    return { items, nextCursor: resp.next_page ?? null }
  },
}
