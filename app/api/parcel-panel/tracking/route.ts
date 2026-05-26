import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthContext } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { parseJson } from '@/lib/utils/typed-json'
import { validateQuery } from '@/lib/validation'
import { trackingQuery } from '@/lib/schemas/parcel-panel'
import { logger } from '@/lib/logger'

interface ParcelPanelIntegration {
  parcelpanel_api_key?: string
}

interface TrackingOrderResponse {
  order?: Record<string, unknown>
}

const PP_BASE = 'https://open.parcelwill.com'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [query, queryErr] = validateQuery(request, trackingQuery)
  if (queryErr) return queryErr

  // Replace legacy clients.email lookup with workspace-scoped integrations row.
  // Note column name: integrations.parcelpanel_api_key (no underscore between
  // 'parcel' and 'panel' — different from the legacy clients.parcel_panel_api_key).
  const { data: integration } = await supabaseAdmin
    .from('integrations')
    .select('parcelpanel_api_key')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  const apiKey = (integration as ParcelPanelIntegration | null)?.parcelpanel_api_key
  if (!apiKey) {
    return NextResponse.json({ error: 'Parcel Panel not configured' }, { status: 404 })
  }

  const ppHeaders = { 'x-parcelpanel-api-key': apiKey as string, 'Accept': 'application/json' }

  // ── Mode A: specific order numbers ────────────────────────────────────────
  const ordersParam = query.orders || ''
  if (ordersParam) {
    const orderNumbers = ordersParam.split(',').map(o => o.trim()).filter(Boolean).slice(0, 20)
    const results = await Promise.allSettled(
      orderNumbers.map(async (num) => {
        const orderNum = num.startsWith('#') ? num : `#${num}`
        try {
          const res = await fetch(
            `${PP_BASE}/api/v2/tracking/order?order_number=${encodeURIComponent(orderNum)}`,
            { headers: ppHeaders, cache: 'no-store' }
          )
          if (!res.ok) return null
          const data = await parseJson<TrackingOrderResponse>(res)
          return data.order || null
        } catch { return null }
      })
    )
    const orders = results
      .filter((r): r is PromiseFulfilledResult<Record<string, unknown> | null> => r.status === 'fulfilled' && r.value != null)
      .map(r => r.value as Record<string, unknown>)
    return NextResponse.json({ orders })
  }

  // ── Mode B: shipments from DB filtered by workspace ───────────────────────
  const { data: shipments, error } = await supabaseAdmin
    .from('shipments')
    .select('*')
    .eq('workspace_id', ctx.workspaceId)
    .order('last_updated', { ascending: false })

  if (error) {
    logger.error('[parcel-panel/tracking]', 'DB error', { error: error.message })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ orders: shipments || [] })
}
