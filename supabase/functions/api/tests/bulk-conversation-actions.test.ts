import { assertEquals, assertThrows } from '@std/assert'
import { resolveBulkAction, BulkActionError } from '../lib/services/bulk-conversation-actions.ts'

Deno.test('mark_read sets is_unread false', () => {
  assertEquals(resolveBulkAction('mark_read'), { kind: 'update', updates: { is_unread: false } })
})

Deno.test('resolve sets status resolved', () => {
  assertEquals(resolveBulkAction('resolve'), { kind: 'update', updates: { status: 'resolved' } })
})

Deno.test('snooze sets status snoozed + snoozed_until', () => {
  assertEquals(
    resolveBulkAction('snooze', { until: '2026-06-20T10:00:00Z' }),
    { kind: 'update', updates: { status: 'snoozed', snoozed_until: '2026-06-20T10:00:00Z' } },
  )
})

Deno.test('snooze with no until stores null', () => {
  assertEquals(resolveBulkAction('snooze'), { kind: 'update', updates: { status: 'snoozed', snoozed_until: null } })
})

Deno.test('assign sets assigned_to, empty string -> null', () => {
  assertEquals(resolveBulkAction('assign', { memberId: 'm1' }), { kind: 'update', updates: { assigned_to: 'm1' } })
  assertEquals(resolveBulkAction('assign', { memberId: '' }), { kind: 'update', updates: { assigned_to: null } })
})

Deno.test('assign without memberId key throws', () => {
  assertThrows(() => resolveBulkAction('assign', {}), BulkActionError)
})

Deno.test('move only allows open/pending/resolved', () => {
  assertEquals(resolveBulkAction('move', { status: 'pending' }), { kind: 'update', updates: { status: 'pending' } })
  assertThrows(() => resolveBulkAction('move', { status: 'closed' }), BulkActionError)
  assertThrows(() => resolveBulkAction('move', {}), BulkActionError)
})

Deno.test('spam sets is_spam true', () => {
  assertEquals(resolveBulkAction('spam'), { kind: 'update', updates: { is_spam: true } })
})

Deno.test('delete sets status closed', () => {
  assertEquals(resolveBulkAction('delete'), { kind: 'update', updates: { status: 'closed' } })
})

Deno.test('add_tag / remove_tag require tagId', () => {
  assertEquals(resolveBulkAction('add_tag', { tagId: 't1' }), { kind: 'tag', op: 'add', tagId: 't1' })
  assertEquals(resolveBulkAction('remove_tag', { tagId: 't1' }), { kind: 'tag', op: 'remove', tagId: 't1' })
  assertThrows(() => resolveBulkAction('add_tag', {}), BulkActionError)
})

Deno.test('emma_handoff returns emma plan', () => {
  assertEquals(resolveBulkAction('emma_handoff'), { kind: 'emma' })
})

Deno.test('unknown action throws', () => {
  assertThrows(() => resolveBulkAction('nope' as never), BulkActionError)
})
