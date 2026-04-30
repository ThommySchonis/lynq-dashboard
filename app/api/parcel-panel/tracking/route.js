import { getUserFromToken, supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

const PP_BASE = 'https://api.parcelpanel.com/api/open/v1'

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('parcel_panel_api_key')
    .eq('email', user.email)
    .single()

  if (!client?.parcel_panel_api_key) {
    return NextResponse.json({ error: 'Parcel Panel not configured' }, { status: 404 })
  }

  const apiKey = client.parcel_panel_api_key
  const ppHeaders = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }

  // ── Mode A: specific order numbers ────────────────────────────────────────
  const ordersParam = request.nextUrl.searchParams.get('orders') || ''
  if (ordersParam) {
    const orderNumbers = ordersParam.split(',').map(o => o.trim()).filter(Boolean).slice(0, 20)
    const results = await Promise.allSettled(
      orderNumbers.map(async (num) => {
        const orderNum = num.startsWith('#') ? num : `#${num}`
        try {
          const res = await fetch(
            `${PP_BASE}/shipments?order_number=${encodeURIComponent(orderNum)}`,
            { headers: ppHeaders, cache: 'no-store' }
          )
          if (!res.ok) return null
          const data = await res.json()
          const raw = data.data ?? data.orders ?? data.trackings ?? data.shipments ?? data
          return Array.isArray(raw) ? raw[0] : raw
        } catch { return null }
      })
    )
    const orders = results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value)
    return NextResponse.json({ orders })
  }

  // ── Mode B: list all tracked orders ──────────────────────────────────────
  const page  = Math.max(1, parseInt(request.nextUrl.searchParams.get('page')  || '1', 10) || 1)
  const limit = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get('limit') || '50', 10) || 50, 1), 100)

  try {
    const res = await fetch(
      `${PP_BASE}/shipments?page=${page}&limit=${limit}`,
      { headers: ppHeaders, cache: 'no-store' }
    )

    if (!res.ok) {
      const body = await res.text()
      console.error('[parcel-panel/tracking] PP error', res.status, body)
      return NextResponse.json({ error: 'Parcel Panel API error', detail: body }, { status: 502 })
    }

    const data = await res.json()
    console.log('[parcel-panel/tracking] PP response keys:', Object.keys(data))

    // Normalize — PP may nest under different keys
    const raw = data.data ?? data.orders ?? data.trackings ?? data.shipments ?? data
    const orders = Array.isArray(raw) ? raw : (raw?.orders ?? raw?.trackings ?? raw?.shipments ?? raw?.data ?? [])
    return NextResponse.json({ orders: Array.isArray(orders) ? orders : [] })
  } catch (e) {
    console.error('[parcel-panel/tracking] fetch error', e)
    return NextResponse.json({ error: 'Failed to reach Parcel Panel' }, { status: 500 })
  }
}
