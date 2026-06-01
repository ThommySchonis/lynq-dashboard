import { assertEquals } from '@std/assert'
import { Hono } from 'hono'
import { cors } from '../../api/middleware/cors.ts'

Deno.test('CORS: preflight returns 204 with correct headers', async () => {
  const app = new Hono()
  app.use('*', cors)
  app.get('/test', (c) => c.text('ok'))

  const res = await app.request('/test', {
    method: 'OPTIONS',
    headers: { Origin: 'https://lynq-dashboard.vercel.app' },
  })

  assertEquals(res.status, 204)
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), 'https://lynq-dashboard.vercel.app')
  assertEquals(res.headers.get('Access-Control-Allow-Credentials'), 'true')
})

Deno.test('CORS: normal request gets CORS headers', async () => {
  const app = new Hono()
  app.use('*', cors)
  app.get('/test', (c) => c.text('ok'))

  const res = await app.request('/test', {
    headers: { Origin: 'https://lynq-dashboard.vercel.app' },
  })

  assertEquals(res.status, 200)
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), 'https://lynq-dashboard.vercel.app')
})

Deno.test('CORS: disallowed origin gets no CORS header', async () => {
  const app = new Hono()
  app.use('*', cors)
  app.get('/test', (c) => c.text('ok'))

  const res = await app.request('/test', {
    headers: { Origin: 'https://evil.com' },
  })

  assertEquals(res.status, 200)
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), null)
})
