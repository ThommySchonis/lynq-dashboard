import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { getAuthContext } from '../../../../lib/auth'
import { NextResponse } from 'next/server'

const PP_BASE = 'https://open.parcelwill.com'

export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Replace legacy clients.email lookup with workspace-scoped integrations row.
  // Note column name: integrations.parcelpanel_api_key (no underscore between
  // 'parcel' and 'panel' — different from the legacy clients.parcel_panel_api_key).
  const { data: integration } = await supabaseAdmin
    .from('integrations')
    .select('parcelpanel_api_key')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  const apiKey = integration?.parcelpanel_api_key
  if (!apiKey) {
    return NextResponse.json({ error: 'Parcel Panel not configured' }, { status: 404 })
  }

  const ppHeaders = { 'x-parcelpanel-api-key': apiKey, 'Accept': 'application/json' }

  // ── Mode A: specific order numbers ────────────────────────────────────────
  const ordersParam = request.nextUrl.searchParams.get('orders') || ''
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
          const data = await res.json()
          return data.order || null
        } catch { return null }
      })
    )
    const orders = results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value)
    return NextResponse.json({ orders })
  }

  // ── Mode B: shipments from DB filtered by workspace ───────────────────────
  const { data: shipments, error } = await supabaseAdmin
    .from('shipments')
    .select('*')
    .eq('workspace_id', ctx.workspaceId)
    .order('last_updated', { ascending: false })

  if (error) {
    console.error('[parcel-panel/tracking] DB error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ orders: shipments || [] })
}
