import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { handleShopifyWebhook } from '@/lib/services/webhookHandlers'
import { logger } from '@/lib/logger'

interface RetryRequest {
  event_type: string
  payload: Record<string, unknown>
  workspace_id: string | null
  metadata: Record<string, unknown> | null
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-retry-secret')
  if (!secret || secret !== process.env.WEBHOOK_RETRY_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as RetryRequest

  try {
    await handleShopifyWebhook(
      body.event_type,
      body.payload,
      body.workspace_id || '',
      (body.metadata?.storeId as string) || null,
      (body.metadata?.clientId as string) || ''
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error('[webhook-retry/shopify]', 'handler failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }
}
