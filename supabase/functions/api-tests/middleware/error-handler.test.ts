import { assertEquals } from '@std/assert'
import { Hono } from 'hono'
import { errorHandler } from '../../api/middleware/error-handler.ts'

Deno.test('errorHandler: catches thrown errors and returns 500 JSON', async () => {
  const app = new Hono()
  app.onError(errorHandler)
  app.get('/boom', () => {
    throw new Error('Something broke')
  })

  const res = await app.request('/boom')
  const body = await res.json()

  assertEquals(res.status, 500)
  assertEquals(body.error, 'Internal Server Error')
})

Deno.test('errorHandler: passes through successful responses', async () => {
  const app = new Hono()
  app.onError(errorHandler)
  app.get('/ok', (c) => c.json({ status: 'ok' }))

  const res = await app.request('/ok')
  const body = await res.json()

  assertEquals(res.status, 200)
  assertEquals(body.status, 'ok')
})
