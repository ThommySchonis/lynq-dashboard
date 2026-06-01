import { assertEquals } from '@std/assert'
import { Hono } from 'hono'
import { requireWriteAccess, requireNotImpersonating } from '../../api/middleware/workspace.ts'
import type { AuthContext } from '../../api/lib/types.ts'

function createApp(guardFn: (c: any) => Response | null, ctx: Partial<AuthContext>) {
  const app = new Hono()
  app.use('*', async (c, next) => {
    // deno-lint-ignore no-explicit-any
    ;(c as any).set('authContext', ctx)
    await next()
  })
  app.post('/test', (c) => {
    const blocked = guardFn(c)
    if (blocked) return blocked
    return c.json({ ok: true })
  })
  return app
}

Deno.test('requireWriteAccess: allows non-suspended workspace', async () => {
  const app = createApp(requireWriteAccess, { isSuspended: false })
  const res = await app.request('/test', { method: 'POST' })
  assertEquals(res.status, 200)
})

Deno.test('requireWriteAccess: blocks suspended workspace with 403', async () => {
  const app = createApp(requireWriteAccess, { isSuspended: true })
  const res = await app.request('/test', { method: 'POST' })
  assertEquals(res.status, 403)
  const body = await res.json()
  assertEquals(body.error, 'workspace_suspended')
})

Deno.test('requireNotImpersonating: allows normal user', async () => {
  const app = createApp(requireNotImpersonating, { isImpersonating: false })
  const res = await app.request('/test', { method: 'POST' })
  assertEquals(res.status, 200)
})

Deno.test('requireNotImpersonating: blocks impersonating user with 403', async () => {
  const app = createApp(requireNotImpersonating, { isImpersonating: true })
  const res = await app.request('/test', { method: 'POST' })
  assertEquals(res.status, 403)
  const body = await res.json()
  assertEquals(body.error, 'impersonation_restricted')
})
