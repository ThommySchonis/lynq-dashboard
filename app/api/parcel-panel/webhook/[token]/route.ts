import { createHmac, timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { parcelPanelWebhookPayload } from '@/lib/schemas/parcel-panel'

const OK = () => NextResponse.json({ received: true })

interface Integration {
  parcelpanel_api_key: string
  workspace_id: string
  store_id: string
}

function verifyHmac(rawBody: string, signature: string, apiKey: string): boolean {
  const computed = createHmac('sha256', apiKey)
    .update(rawBody)
    .digest('base64')

  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(signature))
  } catch {
    return false
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // 1. Look up integration by webhook token
  const { data: integration } = await supabaseAdmin
    .from('integrations')
    .select('parcelpanel_api_key, workspace_id, store_id')
    .eq('parcelpanel_webhook_token', token)
    .maybeSingle()

  if (!integration) {
    console.warn('[parcel-panel/webhook] token not found:', token.substring(0, 8))
    return OK()
  }

  const { parcelpanel_api_key, workspace_id, store_id } = integration as Integration

  // 2. Read raw body for HMAC verification
  const rawBody = await request.text()

  // 3. Verify HMAC signature
  const signature = request.headers.get('x-parcelpanel-hmac-sha256')
  if (!signature) {
    console.warn('[parcel-panel/webhook] HMAC header missing')
    return OK()
  }

  if (!verifyHmac(rawBody, signature, parcelpanel_api_key)) {
    console.warn('[parcel-panel/webhook] HMAC mismatch for token:', token.substring(0, 8))
    return OK()
  }

  // 4. Parse and validate payload
  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    console.warn('[parcel-panel/webhook] invalid JSON:', rawBody.substring(0, 500))
    return OK()
  }

  const result = parcelPanelWebhookPayload.safeParse(parsed)
  if (!result.success) {
    console.warn('[parcel-panel/webhook] payload validation failed:', rawBody.substring(0, 500))
    return OK()
  }

  const payload = result.data

  // 5. Upsert into shipments
  const { error } = await supabaseAdmin
    .from('shipments')
    .upsert(
      {
        workspace_id,
        store_id,
        order_number: payload.order_number,
        tracking_number: payload.tracking_number,
        carrier: payload.carrier.name,
        status: payload.status,
        customer_name: payload.customer?.name ?? null,
        estimated_delivery: payload.estimated_delivery_date ?? null,
        last_updated: new Date().toISOString(),
        raw_data: parsed,
      },
      { onConflict: 'workspace_id, tracking_number' }
    )

  if (error) {
    console.error('[parcel-panel/webhook] upsert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.info('[parcel-panel/webhook] upserted:', payload.tracking_number)
  return OK()
}
