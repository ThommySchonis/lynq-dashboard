import { getUserFromToken, supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

const PP_BASE = 'https://open.parcelwill.com'

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: clients } = await supabaseAdmin
    .from('clients')
    .select('id, parcel_panel_api_key')
    .eq('email', user.email)
    .limit(1)

  const client = clients?.[0]
  if (!client?.parcel_panel_api_key) {
    return NextResponse.json({ error: 'Parcel Panel not configured' }, { status: 404 })
  }

  const apiKey = client.parcel_panel_api_key
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

  // ── Mode B: shipments from DB filtered by client_id ───────────────────────
  const { data: shipments, error } = await supabaseAdmin
    .from('shipments')
    .select('*')
    .eq('client_id', client.id)
    .order('last_updated', { ascending: false })

  if (error) {
    console.error('[parcel-panel/tracking] DB error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ orders: shipments || [] })
}
