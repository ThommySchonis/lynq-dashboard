import { assertEquals } from '@std/assert'
import { Hono } from 'hono'
import { authMiddleware } from '../../api/middleware/auth.ts'
import type { AuthContext } from '../../api/lib/types.ts'

function createTestApp() {
  const app = new Hono()
  app.use('*', authMiddleware)
  app.get('/test', (c) => {
    // deno-lint-ignore no-explicit-any
    const ctx = (c as any).get('authContext') as AuthContext
    return c.json({ workspaceId: ctx.workspaceId, role: ctx.role })
  })
  return app
}

Deno.test('auth: missing Authorization header returns 401', async () => {
  const app = createTestApp()
  const res = await app.request('/test')
  assertEquals(res.status, 401)
  const body = await res.json()
  assertEquals(body.error, 'Unauthorized')
})

Deno.test('auth: malformed Bearer token returns 401', async () => {
  const app = createTestApp()
  const res = await app.request('/test', {
    headers: { Authorization: 'Bearer invalid-token-xxx' },
  })
  assertEquals(res.status, 401)
})
