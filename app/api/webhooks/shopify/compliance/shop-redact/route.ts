import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { logger } from '@/lib/logger'
import {
  verifyHmacAgainstAppSecret,
  logComplianceWebhook,
  resolveWorkspaceForShop,
  processShopRedact,
  markWorkerFailed,
  type ShopRedactPayload,
} from '@/lib/services/shopify-compliance'

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const hmacHeader = request.headers.get('x-shopify-hmac-sha256')
  const shopifyWebhookId = request.headers.get('x-shopify-webhook-id')

  const { ok, secretUsed } = verifyHmacAgainstAppSecret(rawBody, hmacHeader)
  if (!ok) {
    return NextResponse.json({ error: 'Invalid HMAC' }, { status: 401 })
  }

  let payload: ShopRedactPayload
  try {
    payload = JSON.parse(rawBody) as ShopRedactPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // workspaceId may be null here — the integration row may already have been
  // deleted by the merchant 48 hours before this webhook fires. That's fine;
  // shop/redact worker handles the null case.
  const { workspaceId } = await resolveWorkspaceForShop(payload.shop_domain)

  let logResult: Awaited<ReturnType<typeof logComplianceWebhook>>
  try {
    logResult = await logComplianceWebhook({
      topic: 'shop/redact',
      shopDomain: payload.shop_domain,
      shopifyShopId: payload.shop_id ?? null,
      shopifyCustomerId: null,
      customerEmail: null,
      workspaceId,
      hmacOk: true,
      hmacSecretUsed: secretUsed,
      payload,
      shopifyWebhookId,
    })
  } catch (err: unknown) {
    logger.error(
      '[webhook/shopify/compliance/shop-redact]',
      'log insert failed',
      { error: err instanceof Error ? err.message : String(err) }
    )
    return NextResponse.json({ error: 'Log insert failed' }, { status: 500 })
  }

  if ('duplicate' in logResult) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  void processShopRedact(logResult.row).catch((err) =>
    markWorkerFailed(logResult.row.id, err)
  )

  return NextResponse.json({ ok: true })
}
