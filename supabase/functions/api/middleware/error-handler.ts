import type { ErrorHandler } from 'hono'

// Note: Sentry initialization deferred — SENTRY_DSN will be set later.
// For now, errors are logged to console (visible in Supabase function logs).
// When SENTRY_DSN is set, add: import * as Sentry from '@sentry/deno'

export const errorHandler: ErrorHandler = (err, c) => {
  const message = err instanceof Error ? err.message : 'Unknown error'
  console.error('[api] Unhandled error:', message)

  return c.json(
    { error: 'Internal Server Error' },
    500
  )
}
