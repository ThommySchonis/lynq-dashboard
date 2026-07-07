import { assertEquals } from '@std/assert'
import { pickPrimaryMembership } from '../lib/pick-membership.ts'

interface Row {
  id: string
  workspace_id: string
  role: string
  joined_at: string
}

const row = (id: string, role: string, joined_at: string): Row => ({
  id,
  workspace_id: `ws-${id}`,
  role,
  joined_at,
})

Deno.test('returns null when there are no memberships', () => {
  assertEquals(pickPrimaryMembership<Row>([]), null)
})

Deno.test('returns the only membership when there is one', () => {
  const only = row('a', 'agent', '2026-01-01T00:00:00Z')
  assertEquals(pickPrimaryMembership([only]), only)
})

Deno.test('prefers an owned workspace over invited ones regardless of order', () => {
  const invited = row('a', 'agent', '2025-01-01T00:00:00Z') // older, but not owner
  const owned = row('b', 'owner', '2026-06-01T00:00:00Z') // newer, owner
  assertEquals(pickPrimaryMembership([invited, owned])?.id, 'b')
  assertEquals(pickPrimaryMembership([owned, invited])?.id, 'b')
})

Deno.test('among owned workspaces, picks the earliest joined_at (real workspace over provisioned junk)', () => {
  const real = row('real', 'owner', '2026-01-01T00:00:00Z')
  const junk1 = row('junk1', 'owner', '2026-06-01T00:00:00Z')
  const junk2 = row('junk2', 'owner', '2026-06-02T00:00:00Z')
  assertEquals(pickPrimaryMembership([junk2, real, junk1])?.id, 'real')
})

Deno.test('with no owned workspace, picks the earliest invited membership', () => {
  const later = row('later', 'agent', '2026-02-01T00:00:00Z')
  const earlier = row('earlier', 'admin', '2026-01-01T00:00:00Z')
  assertEquals(pickPrimaryMembership([later, earlier])?.id, 'earlier')
})

Deno.test('tie-breaks on id when role and joined_at are equal (fully deterministic)', () => {
  const a = row('aaa', 'owner', '2026-01-01T00:00:00Z')
  const b = row('bbb', 'owner', '2026-01-01T00:00:00Z')
  assertEquals(pickPrimaryMembership([b, a])?.id, 'aaa')
  assertEquals(pickPrimaryMembership([a, b])?.id, 'aaa')
})
