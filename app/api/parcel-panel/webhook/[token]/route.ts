import { createHash, createHmac, timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { parcelPanelWebhookPayload } from '@/lib/schemas/parcel-panel'
import { withIdempotency } from '@/lib/services/webhookIdempotency'

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

  return withIdempotency({
    rawBody,
    request,
    source: 'parcelpanel',
    eventType: 'shipment_update',
    workspaceId: workspace_id,
    extractEventId: (_req, body) => {
      const p = parcelPanelWebhookPayload.safeParse(body)
      if (!p.success) return null
      const raw = `${p.data.tracking_number}:${p.data.status}:${p.data.order_number}`
      return createHash('sha256').update(raw).digest('hex')
    },
    handler: async (body) => {
      const result = parcelPanelWebhookPayload.safeParse(body)
      if (!result.success) {
        console.warn('[parcel-panel/webhook] payload validation failed')
        return { response: OK() }
      }

      const payload = result.data

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
            raw_data: body,
          },
          { onConflict: 'workspace_id, tracking_number' }
        )

      if (error) {
        console.error('[parcel-panel/webhook] upsert error:', error.message)
        throw error
      }

      console.info('[parcel-panel/webhook] upserted:', payload.tracking_number)
      return { response: OK(), workspaceId: workspace_id }
    },
  })
}
