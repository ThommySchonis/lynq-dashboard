import { assertEquals } from '@std/assert'
import { gorgias } from '../lib/services/migrations/adapters/gorgias.ts'

const FIXTURE_BASE = new URL('./__fixtures__/gorgias/', import.meta.url)

async function loadFixture(name: string): Promise<unknown> {
  const url = new URL(name, FIXTURE_BASE)
  return JSON.parse(await Deno.readTextFile(url))
}

function withMockFetch(routes: Record<string, unknown | (() => Response)>): () => void {
  const orig = globalThis.fetch
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    for (const [pattern, handler] of Object.entries(routes)) {
      if (url.includes(pattern)) {
        if (typeof handler === 'function') return handler()
        return new Response(JSON.stringify(handler), { status: 200, headers: { 'content-type': 'application/json' } })
      }
    }
    throw new Error(`Unexpected fetch: ${url}`)
  }
  return () => { globalThis.fetch = orig }
}

Deno.test('gorgias.listMailboxes: returns one entry per email channel', async () => {
  const restore = withMockFetch({ '/api/channels': await loadFixture('channels.json') })
  try {
    const mailboxes = await gorgias.listMailboxes({ authMethod: 'api_key', subdomain: 'brand.gorgias.com', username: 'a@b.com', apiKey: 'k' })
    assertEquals(mailboxes.length, 2)
    assertEquals(mailboxes[0].email, 'support@brand.com')
    assertEquals(mailboxes[0].source_id, '101')
  } finally { restore() }
})

Deno.test('gorgias.fetchTags: returns one page with nextCursor null when meta.next_page is null', async () => {
  const restore = withMockFetch({ '/api/tags': await loadFixture('tags.json') })
  try {
    const page = await gorgias.fetchTags({ authMethod: 'api_key', subdomain: 'brand.gorgias.com', username: 'a@b.com', apiKey: 'k' }, null)
    assertEquals(page.items.length, 2)
    assertEquals(page.items[0].name, 'VIP')
    assertEquals(page.nextCursor, null)
  } finally { restore() }
})

Deno.test('gorgias.fetchConversations: normalizes messages with correct direction', async () => {
  const restore = withMockFetch({ '/api/tickets': await loadFixture('tickets-page-1.json') })
  try {
    const page = await gorgias.fetchConversations(
      { authMethod: 'api_key', subdomain: 'brand.gorgias.com', username: 'a@b.com', apiKey: 'k' },
      { start: '2026-01-01T00:00:00Z', end: '2026-06-10T00:00:00Z' },
      ['101'],
      null,
    )
    assertEquals(page.items.length, 1)
    const c = page.items[0]
    assertEquals(c.source_external_id, '7001')
    assertEquals(c.source_mailbox_id, '101')
    assertEquals(c.tag_external_ids, ['5001'])
    assertEquals(c.messages.length, 2)
    assertEquals(c.messages[0].direction, 'inbound')
    assertEquals(c.messages[1].direction, 'outbound')
  } finally { restore() }
})

Deno.test('gorgias: rate limit 429 with Retry-After is honored once then succeeds', async () => {
  let calls = 0
  const restore = withMockFetch({
    '/api/tags': () => {
      calls++
      if (calls === 1) {
        return new Response('rate limited', { status: 429, headers: { 'Retry-After': '0' } })
      }
      return new Response(JSON.stringify({ data: [{ id: 1, name: 'x', color: null }], meta: { next_page: null } }), { status: 200 })
    },
  })
  try {
    const page = await gorgias.fetchTags({ authMethod: 'api_key', subdomain: 'brand.gorgias.com', username: 'a@b.com', apiKey: 'k' }, null)
    assertEquals(page.items.length, 1)
    assertEquals(calls, 2)
  } finally { restore() }
})

Deno.test('gorgias.verifyCredentials: throws on 401', async () => {
  const restore = withMockFetch({ '/api/account': () => new Response('Unauthorized', { status: 401 }) })
  try {
    let threw = false
    try {
      await gorgias.verifyCredentials({ authMethod: 'api_key', subdomain: 'brand.gorgias.com', username: 'a@b.com', apiKey: 'bad' })
    } catch { threw = true }
    assertEquals(threw, true)
  } finally { restore() }
})
