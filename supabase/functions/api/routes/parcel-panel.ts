import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import { requireCapability } from '../middleware/workspace.ts'
import { getAdminClient } from '../lib/supabase.ts'
import type { AuthContext } from '../lib/types.ts'

const parcelPanel = new Hono()

// Apply auth middleware selectively — webhook route must be unauthenticated
parcelPanel.use('/connect', authMiddleware)
parcelPanel.use('/tracking', authMiddleware)

function getCtx(c: { get: (key: string) => unknown }): AuthContext {
  return c.get('authContext') as AuthContext
}

async function verifyHmac(
  rawBody: string,
  signature: string,
  apiKey: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(apiKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(rawBody),
  )
  const computed = btoa(String.fromCharCode(...new Uint8Array(sig)))
  if (computed.length !== signature.length) return false
  let mismatch = 0
  for (let i = 0; i < computed.length; i++) {
    mismatch |= computed.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return mismatch === 0
}

// POST /parcel-panel/connect
parcelPanel.post('/connect', async (c) => {
  const ctx = getCtx(c)

  const blocked = requireCapability('manageWorkspace')(c)
  if (blocked) return blocked

  const body = await c.req.json<{ apiKey: string }>()
  if (!body.apiKey) {
    return c.json({ error: 'apiKey is required' }, 400)
  }

  // Verify the API key against ParcelPanel
  const verifyRes = await fetch(
    'https://open.parcelwill.com/api/v2/tracking/order?order_number=%23000',
    {
      headers: { 'Parcel-Panel-Api-Token': body.apiKey },
    },
  )

  if (!verifyRes.ok) {
    return c.json({ error: 'Invalid ParcelPanel API key' }, 400)
  }

  const webhookToken = crypto.randomUUID()

  const sb = getAdminClient()
  const { error } = await sb
    .from('integrations')
    .upsert(
      {
        workspace_id: ctx.workspaceId,
        parcelpanel_api_key: body.apiKey,
        parcelpanel_webhook_token: webhookToken,
      },
      { onConflict: 'workspace_id' },
    )

  if (error) {
    return c.json({ error: error.message }, 500)
  }

  return c.json({ success: true, webhookToken })
})

// GET /parcel-panel/tracking
parcelPanel.get('/tracking', async (c) => {
  const ctx = getCtx(c)

  const ordersParam = c.req.query('orders')

  const sb = getAdminClient()
  const { data: integration } = await sb
    .from('integrations')
    .select('parcelpanel_api_key')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  const apiKey = (integration as Record<string, unknown> | null)?.parcelpanel_api_key as string | null
  if (!apiKey) {
    return c.json({ error: 'ParcelPanel is not connected' }, 400)
  }

  // Mode A: fetch specific orders from ParcelPanel API
  if (ordersParam) {
    const orderNumbers = ordersParam.split(',').map((o) => o.trim()).filter(Boolean)
    const orders = await Promise.all(
      orderNumbers.map(async (orderNumber) => {
        const res = await fetch(
          `https://open.parcelwill.com/api/v2/tracking/order?order_number=${encodeURIComponent(orderNumber)}`,
          {
            headers: { 'Parcel-Panel-Api-Token': apiKey },
          },
        )
        if (!res.ok) return { order_number: orderNumber, error: 'Failed to fetch' }
        return await res.json()
      }),
    )
    return c.json({ orders })
  }

  // Mode B: query local shipments table
  const { data: shipments, error } = await sb
    .from('shipments')
    .select('*')
    .eq('workspace_id', ctx.workspaceId)
    .order('created_at', { ascending: false })

  if (error) {
    return c.json({ error: error.message }, 500)
  }

  return c.json({ orders: shipments })
})

// POST /parcel-panel/webhook/:token — NO auth middleware
parcelPanel.post('/webhook/:token', async (c) => {
  const token = c.req.param('token')

  const sb = getAdminClient()
  const { data: integration } = await sb
    .from('integrations')
    .select('workspace_id, parcelpanel_api_key')
    .eq('parcelpanel_webhook_token', token)
    .maybeSingle()

  if (!integration) {
    return c.json({ error: 'Invalid webhook token' }, 401)
  }

  const rawBody = await c.req.text()
  const signature = c.req.header('X-Parcelpanel-Hmac-Sha256') ?? ''
  const apiKey = (integration as Record<string, unknown>).parcelpanel_api_key as string

  if (signature) {
    const valid = await verifyHmac(rawBody, signature, apiKey)
    if (!valid) {
      return c.json({ error: 'Invalid signature' }, 401)
    }
  }

  // Placeholder: log and acknowledge — full handler will be ported with webhooks batch
  console.log('[parcel-panel] webhook received for workspace:', (integration as Record<string, unknown>).workspace_id)

  return c.json({ received: true })
})

export { parcelPanel as parcelPanelRoutes }

// ── Separate router for /parcelpanel (no hyphen) ────────────────────────────

const parcelPanelShipments = new Hono()
parcelPanelShipments.use('*', authMiddleware)

// GET /parcelpanel/shipments
parcelPanelShipments.get('/shipments', async (c) => {
  const ctx = getCtx(c)

  const storeId = c.req.query('store_id')
  const status = c.req.query('status')
  const page = parseInt(c.req.query('page') ?? '1', 10)
  const limit = parseInt(c.req.query('limit') ?? '20', 10)

  const sb = getAdminClient()

  // Look up parcelpanel_api_key for the store's workspace
  let integrationQuery = sb
    .from('integrations')
    .select('parcelpanel_api_key')
    .eq('workspace_id', ctx.workspaceId)

  if (storeId) {
    integrationQuery = integrationQuery.eq('store_id', storeId)
  }

  const { data: integration } = await integrationQuery.maybeSingle()

  const apiKey = (integration as Record<string, unknown> | null)?.parcelpanel_api_key as string | null
  if (!apiKey) {
    return c.json({ connected: false, shipments: [], summary: null, page, totalPages: 0 })
  }

  // Fetch from ParcelPanel API
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', String(limit))
  if (status) params.set('status', status)

  const res = await fetch(
    `https://www.parcelpanel.com/api/open/v2/trackings?${params.toString()}`,
    {
      headers: { 'Parcel-Panel-Api-Token': apiKey },
    },
  )

  if (!res.ok) {
    const errBody = await res.text()
    console.error('[parcelpanel] shipments fetch failed:', res.status, errBody)
    return c.json({ error: 'Failed to fetch shipments from ParcelPanel' }, 502)
  }

  const data = await res.json() as Record<string, unknown>

  // Normalize response
  const trackings = (data.trackings ?? data.data ?? []) as Record<string, unknown>[]
  const total = (data.total ?? trackings.length) as number
  const totalPages = Math.ceil(total / limit)

  const shipments = trackings.map((t) => ({
    tracking_number: t.tracking_number,
    courier_code: t.courier_code,
    order_number: t.order_number,
    status: t.delivery_status ?? t.status,
    last_event: t.last_event,
    estimated_delivery: t.estimated_delivery_date,
    updated_at: t.updated_at,
  }))

  const summary = {
    total,
    page,
    limit,
  }

  return c.json({ connected: true, shipments, summary, page, totalPages })
})

export { parcelPanelShipments as parcelPanelShipmentsRoutes }
