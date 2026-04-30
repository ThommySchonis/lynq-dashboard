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
    .select('parcel_panel_api_key')
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

  // ── Mode B: paginated list ────────────────────────────────────────────────
  const page  = Math.max(1, parseInt(request.nextUrl.searchParams.get('page')  || '1', 10) || 1)
  const limit = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get('limit') || '50', 10) || 50, 1), 100)

  console.log('[parcel-panel/tracking] fetching page', page, 'limit', limit)

  try {
    const res = await fetch(
      `${PP_BASE}/api/v2/tracking?page=${page}&limit=${limit}`,
      { headers: ppHeaders, cache: 'no-store' }
    )

    console.log('[parcel-panel/tracking] PP status:', res.status)
    const text = await res.text()
    console.log('[parcel-panel/tracking] PP response:', text.substring(0, 500))

    let data
    try {
      data = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'Invalid tracking response from Parcel Panel' }, { status: 502 })
    }

    if (res.status === 404) {
      // PP returns 404 when there are no tracked shipments yet
      return NextResponse.json({ orders: [] })
    }
    if (!res.ok) {
      return NextResponse.json({ error: data?.message || 'Parcel Panel API error' }, { status: 502 })
    }

    const raw = data.orders ?? data.trackings ?? data.data ?? data
    const orders = Array.isArray(raw) ? raw : (raw?.orders ?? raw?.trackings ?? raw?.data ?? [])
    return NextResponse.json({ orders: Array.isArray(orders) ? orders : [] })
  } catch (e) {
    console.error('[parcel-panel/tracking] fetch error', e)
    return NextResponse.json({ error: 'Failed to reach Parcel Panel' }, { status: 500 })
  }
}
