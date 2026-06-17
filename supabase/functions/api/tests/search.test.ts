import { assertEquals } from '@std/assert'
import { escapeForOrFilter, makeSnippet } from '../lib/services/search.ts'

Deno.test('escapeForOrFilter: returns plain text unchanged', () => {
  assertEquals(escapeForOrFilter('refund'), 'refund')
})

Deno.test('escapeForOrFilter: escapes percent', () => {
  assertEquals(escapeForOrFilter('50%'), '50\\%')
})

Deno.test('escapeForOrFilter: escapes underscore', () => {
  assertEquals(escapeForOrFilter('user_name'), 'user\\_name')
})

Deno.test('escapeForOrFilter: escapes comma (PostgREST .or() separator)', () => {
  assertEquals(escapeForOrFilter('hello, world'), 'hello\\, world')
})

Deno.test('escapeForOrFilter: escapes backslash first to avoid double-escaping', () => {
  assertEquals(escapeForOrFilter('a\\b'), 'a\\\\b')
})

Deno.test('escapeForOrFilter: handles all special chars together', () => {
  assertEquals(escapeForOrFilter('50%_off, \\done'), '50\\%\\_off\\, \\\\done')
})

Deno.test('escapeForOrFilter: trims surrounding whitespace', () => {
  assertEquals(escapeForOrFilter('  refund  '), 'refund')
})

Deno.test('makeSnippet: returns text unchanged when shorter than maxLength', () => {
  assertEquals(makeSnippet('hello world', 'world', 200), 'hello world')
})

Deno.test('makeSnippet: returns empty string for null/undefined/empty input', () => {
  assertEquals(makeSnippet(null, 'q', 200), '')
  assertEquals(makeSnippet(undefined, 'q', 200), '')
  assertEquals(makeSnippet('', 'q', 200), '')
})

Deno.test('makeSnippet: centers window around first match', () => {
  const long = 'a'.repeat(300) + 'NEEDLE' + 'b'.repeat(300)
  const out = makeSnippet(long, 'needle', 100)
  // Expect ~50 chars before "NEEDLE" + "NEEDLE" + ~50 chars after, with ellipses.
  assertEquals(out.startsWith('…'), true)
  assertEquals(out.endsWith('…'), true)
  assertEquals(out.includes('NEEDLE'), true)
  // Snippet plus ellipses, allow some slack on length.
  assertEquals(out.length <= 110, true)
})

Deno.test('makeSnippet: match at start does not prepend ellipsis', () => {
  const text = 'NEEDLE' + 'b'.repeat(300)
  const out = makeSnippet(text, 'needle', 100)
  assertEquals(out.startsWith('…'), false)
  assertEquals(out.endsWith('…'), true)
})

Deno.test('makeSnippet: match at end does not append ellipsis', () => {
  const text = 'a'.repeat(300) + 'NEEDLE'
  const out = makeSnippet(text, 'needle', 100)
  assertEquals(out.startsWith('…'), true)
  assertEquals(out.endsWith('…'), false)
})

Deno.test('makeSnippet: case-insensitive match', () => {
  const out = makeSnippet('Hello WORLD!', 'world', 200)
  assertEquals(out, 'Hello WORLD!')
})

Deno.test('makeSnippet: no match returns leading window with trailing ellipsis', () => {
  const text = 'a'.repeat(300)
  const out = makeSnippet(text, 'needle', 100)
  assertEquals(out.length <= 110, true)
  assertEquals(out.endsWith('…'), true)
})

Deno.test('makeSnippet: collapses whitespace in returned snippet', () => {
  const out = makeSnippet('hello\n\n  world', 'world', 200)
  assertEquals(out, 'hello world')
})

import { groupContactsByEmail } from '../lib/services/search.ts'

Deno.test('groupContactsByEmail: deduplicates by lowercased email', () => {
  const rows = [
    { customer_email: 'JANE@acme.com', customer_name: 'Jane', last_message_at: '2026-06-10T10:00:00Z' },
    { customer_email: 'jane@acme.com', customer_name: 'Jane Smith', last_message_at: '2026-06-11T10:00:00Z' },
  ]
  const out = groupContactsByEmail(rows, 10)
  assertEquals(out.length, 1)
  assertEquals(out[0].email, 'jane@acme.com')
  assertEquals(out[0].conversation_count, 2)
})

Deno.test('groupContactsByEmail: keeps newest non-empty name', () => {
  const rows = [
    { customer_email: 'jane@acme.com', customer_name: 'Jane Smith', last_message_at: '2026-06-11T10:00:00Z' },
    { customer_email: 'jane@acme.com', customer_name: null,         last_message_at: '2026-06-10T10:00:00Z' },
  ]
  const out = groupContactsByEmail(rows, 10)
  assertEquals(out[0].name, 'Jane Smith')
})

Deno.test('groupContactsByEmail: returns newest last_message_at per group', () => {
  const rows = [
    { customer_email: 'a@x.com', customer_name: 'A', last_message_at: '2026-06-09T10:00:00Z' },
    { customer_email: 'a@x.com', customer_name: 'A', last_message_at: '2026-06-11T10:00:00Z' },
    { customer_email: 'a@x.com', customer_name: 'A', last_message_at: '2026-06-10T10:00:00Z' },
  ]
  const out = groupContactsByEmail(rows, 10)
  assertEquals(out[0].last_message_at, '2026-06-11T10:00:00Z')
})

Deno.test('groupContactsByEmail: orders results by newest last_message_at desc', () => {
  const rows = [
    { customer_email: 'a@x.com', customer_name: 'A', last_message_at: '2026-06-10T10:00:00Z' },
    { customer_email: 'b@x.com', customer_name: 'B', last_message_at: '2026-06-11T10:00:00Z' },
  ]
  const out = groupContactsByEmail(rows, 10)
  assertEquals(out.map((c) => c.email), ['b@x.com', 'a@x.com'])
})

Deno.test('groupContactsByEmail: caps result at limit', () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({
    customer_email: `u${i}@x.com`,
    customer_name: `U${i}`,
    last_message_at: `2026-06-${String(11 - (i % 10)).padStart(2, '0')}T00:00:00Z`,
  }))
  const out = groupContactsByEmail(rows, 5)
  assertEquals(out.length, 5)
})

Deno.test('groupContactsByEmail: skips rows with null/empty email', () => {
  const rows = [
    { customer_email: null,  customer_name: 'X', last_message_at: '2026-06-10T10:00:00Z' },
    { customer_email: '',    customer_name: 'Y', last_message_at: '2026-06-10T10:00:00Z' },
    { customer_email: 'a@x', customer_name: 'A', last_message_at: '2026-06-10T10:00:00Z' },
  ]
  const out = groupContactsByEmail(rows, 10)
  assertEquals(out.length, 1)
  assertEquals(out[0].email, 'a@x')
})

import { parseFilterParams } from '../lib/services/search.ts'

Deno.test('parseFilterParams: empty input yields empty filters', () => {
  const r = parseFilterParams({})
  assertEquals(r.error, undefined)
  assertEquals(r.filters, { status: [], assignee: [], dateFrom: null, dateTo: null })
})

Deno.test('parseFilterParams: valid status list', () => {
  const r = parseFilterParams({ status: 'open,ai_staged,spam' })
  assertEquals(r.error, undefined)
  assertEquals(r.filters?.status, ['open', 'ai_staged', 'spam'])
})

Deno.test('parseFilterParams: rejects unknown status', () => {
  const r = parseFilterParams({ status: 'open,snoozed' })
  assertEquals(r.filters, undefined)
  assertEquals(typeof r.error, 'string')
})

Deno.test('parseFilterParams: assignee accepts uuid and unassigned', () => {
  const id = '11111111-1111-1111-1111-111111111111'
  const r = parseFilterParams({ assignee: `${id},unassigned` })
  assertEquals(r.error, undefined)
  assertEquals(r.filters?.assignee, [id, 'unassigned'])
})

Deno.test('parseFilterParams: rejects non-uuid assignee', () => {
  const r = parseFilterParams({ assignee: 'not-a-uuid' })
  assertEquals(r.filters, undefined)
  assertEquals(typeof r.error, 'string')
})

Deno.test('parseFilterParams: valid ISO dates pass through', () => {
  const r = parseFilterParams({ dateFrom: '2026-06-01T00:00:00.000Z', dateTo: '2026-06-16T00:00:00.000Z' })
  assertEquals(r.error, undefined)
  assertEquals(r.filters?.dateFrom, '2026-06-01T00:00:00.000Z')
})

Deno.test('parseFilterParams: rejects malformed date', () => {
  const r = parseFilterParams({ dateFrom: 'last-tuesday' })
  assertEquals(r.filters, undefined)
  assertEquals(typeof r.error, 'string')
})
