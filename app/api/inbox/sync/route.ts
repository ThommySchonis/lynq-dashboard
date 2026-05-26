import { getAuthContext, requireWriteAccess } from '../../../../lib/auth'
import { syncAllAccounts } from '../../../../lib/conversationEngine'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked

  const rl = checkRateLimit(`ws:${ctx.workspaceId}:inbox`, 60, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfterMs: rl.resetMs },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(rl.resetMs / 1000)),
          'X-RateLimit-Limit': '60',
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  try {
    logger.info('[inbox/sync]', 'starting sync', { workspaceId: ctx.workspaceId })
    const result = await syncAllAccounts(ctx.workspaceId)
    logger.info('[inbox/sync]', 'sync complete', { result })
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const stack = err instanceof Error ? err.stack : undefined
    logger.error('[inbox/sync]', 'sync error', { error: message, stack })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
