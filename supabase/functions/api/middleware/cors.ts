import type { MiddlewareHandler } from 'hono'

const ALLOWED_ORIGINS = [
  'https://app.lynqflow.io',
  'https://lynq-dashboard.vercel.app',
  'http://localhost:3000',
  // FRONTEND_URL may hold extra origins (comma-separated) for new domains.
  ...(Deno.env.get('FRONTEND_URL')
    ?.split(',')
    .map((o) => o.trim())
    .filter(Boolean) ?? []),
]

export const cors: MiddlewareHandler = async (c, next) => {
  const origin = c.req.header('Origin') || ''
  const isAllowed = ALLOWED_ORIGINS.includes(origin)

  if (c.req.method === 'OPTIONS') {
    if (!isAllowed) {
      return new Response(null, { status: 204 })
    }
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Workspace-Id',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  await next()

  if (isAllowed) {
    c.res.headers.set('Access-Control-Allow-Origin', origin)
    c.res.headers.set('Access-Control-Allow-Credentials', 'true')
  }
}
