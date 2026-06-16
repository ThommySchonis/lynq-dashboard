import { assertEquals } from '@std/assert'
import { requireCapability } from '../middleware/workspace.ts'

// Minimal fake Hono Context: only `get` (authContext) and `json` are used.
function fakeContext(role: string) {
  return {
    get: (_key: string) => ({ role }),
    json: (data: unknown, status?: number) => ({ data, status }),
  // deno-lint-ignore no-explicit-any
  } as any
}

Deno.test('requireCapability allows a permitted role (returns null)', () => {
  const guard = requireCapability('manageOrders')
  assertEquals(guard(fakeContext('agent')), null)
  assertEquals(guard(fakeContext('admin')), null)
})

Deno.test('requireCapability blocks a denied role with 403', () => {
  const guard = requireCapability('manageOrders')
  const res = guard(fakeContext('observer')) as { status: number; data: { error: string } } | null
  assertEquals(res?.status, 403)
  assertEquals(res?.data.error, 'forbidden')
})

Deno.test('requireCapability blocks agent on admin-only capability', () => {
  const guard = requireCapability('manageWorkspace')
  const res = guard(fakeContext('agent')) as { status: number } | null
  assertEquals(res?.status, 403)
  assertEquals(guard(fakeContext('admin')), null)
})
