import { assertEquals } from '@std/assert'
import { reamaze } from '../lib/services/migrations/adapters/reamaze.ts'

const FIXTURE_BASE = new URL('./__fixtures__/reamaze/', import.meta.url)

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
  subdomain: 'mybrand.reamaze.io',
  username: 'user@brand.com',
  apiKey: 'testapikey',
}

Deno.test('reamaze.listMailboxes: filters to email channels only (channel === 1)', async () => {
  const restore = withMockFetch({ '/channels': await loadFixture('channels.json') })
  try {
    const mailboxes = await reamaze.listMailboxes(CREDS)
    assertEquals(mailboxes.length, 2)
    assertEquals(mailboxes[0].source_id, 'support')
    assertEquals(mailboxes[0].email, 'support@brand.com')
    assertEquals(mailboxes[0].display_name, 'Support')
    assertEquals(mailboxes[1].source_id, 'billing')
    assertEquals(mailboxes[1].email, 'billing@brand.com')
  } finally { restore() }
})

Deno.test('reamaze.verifyCredentials: throws on 401', async () => {
  const restore = withMockFetch({ '/channels': () => new Response('Unauthorized', { status: 401 }) })
  try {
    let threw = false
    try {
      await reamaze.verifyCredentials(CREDS)
    } catch { threw = true }
    assertEquals(threw, true)
  } finally { restore() }
})

Deno.test('reamaze.fetchTags: scans conversations and emits unique tags with nextCursor null', async () => {
  const restore = withMockFetch({ '/conversations': await loadFixture('conversations-page-1.json') })
  try {
    const page = await reamaze.fetchTags(CREDS, null)
    assertEquals(page.nextCursor, null)
    assertEquals(page.items.length, 2)
    const ids = page.items.map((t: { source_external_id: string }) => t.source_external_id).sort()
    assertEquals(ids, ['shipping', 'vip'])
    // names should equal source_external_id for tag-list tags
    for (const item of page.items) {
      assertEquals(item.name, item.source_external_id)
    }
  } finally { restore() }
})

Deno.test('reamaze.fetchMacros: returns 2 templates from fixture', async () => {
  const restore = withMockFetch({ '/response_templates': await loadFixture('response_templates.json') })
  try {
    const page = await reamaze.fetchMacros(CREDS, null)
    assertEquals(page.items.length, 2)
    assertEquals(page.items[0].source_external_id, 'tpl-shipping')
    assertEquals(page.items[0].name, 'Shipping delay')
    assertEquals(page.items[0].body_html, '<p>Sorry for the delay.</p>')
    assertEquals(page.items[0].body_text, null)
    assertEquals(page.nextCursor, null)
  } finally { restore() }
})

Deno.test('reamaze.fetchConversations: mailboxIds filter, skips internal notes, correct direction', async () => {
  const restore = withMockFetch({
    '/conversations/conv-abc/messages': await loadFixture('conv-abc-messages.json'),
    '/conversations': await loadFixture('conversations-page-1.json'),
  })
  try {
    const page = await reamaze.fetchConversations(
      CREDS,
      { start: '2026-05-01T00:00:00Z', end: '2026-05-31T00:00:00Z' },
      ['support'],
      null,
    )
    assertEquals(page.items.length, 1)
    const conv = page.items[0]
    assertEquals(conv.source_external_id, 'conv-abc')
    assertEquals(conv.subject, 'Where is my order?')
    assertEquals(conv.customer_email, 'alice@example.com')
    assertEquals(conv.customer_name, 'Alice')
    assertEquals(conv.status, 'open')
    assertEquals(conv.source_mailbox_id, 'support')
    assertEquals(conv.tag_external_ids, ['vip', 'shipping'])
    // 3 messages in fixture but visibility=1 skipped → 2 messages
    assertEquals(conv.messages.length, 2)
    // First visible message: alice@example.com === author (alice@example.com) → inbound
    assertEquals(conv.messages[0].direction, 'inbound')
    assertEquals(conv.messages[0].body_html, 'Hi, where is my order?')
    // Second visible message: bob@brand.com !== alice@example.com → outbound
    assertEquals(conv.messages[1].direction, 'outbound')
    assertEquals(conv.messages[1].body_html, 'Shipping tomorrow!')
  } finally { restore() }
})
