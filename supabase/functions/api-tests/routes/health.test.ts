import { assertEquals } from '@std/assert'
import { Hono } from 'hono'
import { cors } from '../../api/middleware/cors.ts'
import { errorHandler } from '../../api/middleware/error-handler.ts'
import { healthRoutes } from '../../api/routes/health.ts'

function createApp() {
  const app = new Hono()
  app.use('*', cors)
  app.onError(errorHandler)
  app.route('/health', healthRoutes)
  return app
}

Deno.test('GET /health returns 200 with status ok', async () => {
  const app = createApp()
  const res = await app.request('/health')
  const body = await res.json()

  assertEquals(res.status, 200)
  assertEquals(body.status, 'ok')
  assertEquals(typeof body.timestamp, 'string')
})
