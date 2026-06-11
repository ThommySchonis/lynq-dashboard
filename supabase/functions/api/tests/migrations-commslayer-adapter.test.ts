import { assertEquals } from '@std/assert'
import { commslayer } from '../lib/services/migrations/adapters/commslayer.ts'

const FIXTURE_BASE = new URL('./__fixtures__/commslayer/', import.meta.url)

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

const CREDS = {
  authMethod: 'api_key' as const,
  accessToken: 'test-bearer-token',
}

Deno.test('commslayer.listMailboxes: scans conversations and returns 2 distinct mailboxes', async () => {
  const restore = withMockFetch({ '/conversations': await loadFixture('conversations-page-1.json') })
  try {
    const mailboxes = await commslayer.listMailboxes(CREDS)
    assertEquals(mailboxes.length, 2)
    const ids = mailboxes.map((m) => m.source_id).sort()
    assertEquals(ids, ['10', '11'])
    // Check display_name format
    const mb10 = mailboxes.find((m) => m.source_id === '10')!
    assertEquals(mb10.display_name, 'Inbox #10')
    assertEquals(mb10.email, 'inbox-10@commslayer.local')
  } finally { restore() }
})

Deno.test('commslayer.verifyCredentials: throws on 401', async () => {
  const restore = withMockFetch({ '/conversations': () => new Response('Unauthorized', { status: 401 }) })
  try {
    let threw = false
    try {
      await commslayer.verifyCredentials(CREDS)
    } catch { threw = true }
    assertEquals(threw, true)
  } finally { restore() }
})

Deno.test('commslayer.fetchTags: returns 2 labels with source_external_id as string ids', async () => {
  const restore = withMockFetch({ '/labels': await loadFixture('labels.json') })
  try {
    const page = await commslayer.fetchTags(CREDS, null)
    assertEquals(page.items.length, 2)
    assertEquals(page.items[0].source_external_id, '1')
    assertEquals(page.items[0].name, 'Refund')
    assertEquals(page.items[0].color, '#FF0000')
    assertEquals(page.items[1].source_external_id, '2')
    assertEquals(page.items[1].name, 'Shipping')
    assertEquals(page.items[1].color, null)
    assertEquals(page.nextCursor, null)
  } finally { restore() }
})

Deno.test('commslayer.fetchMacros: returns empty page without making any fetch call', async () => {
  // No routes registered — any unexpected fetch would throw "Unexpected fetch"
  const restore = withMockFetch({})
  try {
    const page = await commslayer.fetchMacros(CREDS, null)
    assertEquals(page.items.length, 0)
    assertEquals(page.nextCursor, null)
  } finally { restore() }
})

Deno.test('commslayer.fetchConversations: contact lookups, private message skipped, correct directions', async () => {
  const restore = withMockFetch({
    '/conversations/5001/messages': await loadFixture('messages-5001.json'),
    '/conversations/5002/messages': await loadFixture('messages-5002.json'),
    '/contacts/900': await loadFixture('contact-900.json'),
    '/contacts/901': await loadFixture('contact-901.json'),
    '/conversations': await loadFixture('conversations-page-1.json'),
  })
  try {
    const page = await commslayer.fetchConversations(
      CREDS,
      { start: '2026-05-01T00:00:00Z', end: '2026-05-31T00:00:00Z' },
      [],
      null,
    )
    assertEquals(page.items.length, 2)

    const conv1 = page.items[0]
    assertEquals(conv1.source_external_id, '5001')
    assertEquals(conv1.status, 'open')
    assertEquals(conv1.customer_email, 'alice@example.com')
    assertEquals(conv1.customer_name, 'Alice')
    assertEquals(conv1.source_mailbox_id, '10')
    assertEquals(conv1.tag_external_ids, ['refund'])
    // 3 messages but private:true skipped → 2 messages
    assertEquals(conv1.messages.length, 2)
    assertEquals(conv1.messages[0].direction, 'inbound')
    assertEquals(conv1.messages[0].body_text, 'Want refund')
    assertEquals(conv1.messages[1].direction, 'outbound')
    assertEquals(conv1.messages[1].body_text, 'Refunded!')

    const conv2 = page.items[1]
    assertEquals(conv2.source_external_id, '5002')
    assertEquals(conv2.status, 'closed')
    assertEquals(conv2.customer_email, 'bob@example.com')
    assertEquals(conv2.messages.length, 0)
  } finally { restore() }
})
