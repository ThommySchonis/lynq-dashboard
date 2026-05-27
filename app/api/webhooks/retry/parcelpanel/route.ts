import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { handleParcelPanelWebhook } from '@/lib/services/webhookHandlers'
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
    await handleParcelPanelWebhook(
      body.payload,
      body.workspace_id || '',
      (body.metadata?.storeId as string) || ''
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error('[webhook-retry/parcelpanel]', 'handler failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }
}
