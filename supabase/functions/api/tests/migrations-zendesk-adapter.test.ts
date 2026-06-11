import { assertEquals } from '@std/assert'
import { zendesk } from '../lib/services/migrations/adapters/zendesk.ts'

const FIXTURE_BASE = new URL('./__fixtures__/zendesk/', import.meta.url)

async function loadFixture(name: string): Promise<unknown> {
  return JSON.parse(await Deno.readTextFile(new URL(name, FIXTURE_BASE)))
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

const creds = { authMethod: 'api_key' as const, subdomain: 'brand', username: 'a@b.com', apiKey: 'tok' }

Deno.test('zendesk.listMailboxes: returns brands', async () => {
  const restore = withMockFetch({ '/brands.json': await loadFixture('brands.json') })
  try {
    const mailboxes = await zendesk.listMailboxes(creds)
    assertEquals(mailboxes.length, 1)
    assertEquals(mailboxes[0].source_id, '360001')
  } finally { restore() }
})

Deno.test('zendesk.fetchTags: returns names with stable source_external_id', async () => {
  const restore = withMockFetch({ '/tags.json': await loadFixture('tags.json') })
  try {
    const page = await zendesk.fetchTags(creds, null)
    assertEquals(page.items.length, 2)
    assertEquals(page.items[0].source_external_id, 'vip')
    assertEquals(page.items[0].name, 'vip')
  } finally { restore() }
})

Deno.test('zendesk.fetchConversations: hydrates requester email + comment authors', async () => {
  const restore = withMockFetch({
    '/tickets.json':              await loadFixture('tickets-page-1.json'),
    '/tickets/200001/comments':   await loadFixture('ticket-200001-comments.json'),
    '/users/show_many.json':      await loadFixture('users-bulk.json'),
  })
  try {
    const page = await zendesk.fetchConversations(creds, { start: '2026-01-01T00:00:00Z', end: '2026-06-10T00:00:00Z' }, ['360001'], null)
    assertEquals(page.items.length, 1)
    const c = page.items[0]
    assertEquals(c.source_external_id, '200001')
    assertEquals(c.customer_email, 'alice@example.com')
    assertEquals(c.messages.length, 2)
    assertEquals(c.messages[0].direction, 'inbound')
    assertEquals(c.messages[1].direction, 'outbound')
    assertEquals(c.tag_external_ids, ['refund'])
  } finally { restore() }
})

Deno.test('zendesk.verifyCredentials: throws on 401', async () => {
  const restore = withMockFetch({ '/users/me.json': () => new Response('nope', { status: 401 }) })
  try {
    let threw = false
    try { await zendesk.verifyCredentials({ ...creds, apiKey: 'bad' }) } catch { threw = true }
    assertEquals(threw, true)
  } finally { restore() }
})
