import { getUserFromToken, supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

const PP_BASE = 'https://open.parcelpanel.com'

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
  const ordersParam = request.nextUrl.searchParams.get('orders') || ''

  // ── Mode A: specific order numbers ────────────────────────────────────────
  if (ordersParam) {
    const orderNumbers = ordersParam.split(',').map(o => o.trim()).filter(Boolean).slice(0, 20)
    const results = await Promise.allSettled(
      orderNumbers.map(async (num) => {
        const orderNum = num.startsWith('#') ? num : `#${num}`
        try {
          const res = await fetch(
            `${PP_BASE}/api/v2/tracking/order?order_number=${encodeURIComponent(orderNum)}`,
            { headers: { 'x-parcelpanel-api-key': apiKey }, cache: 'no-store' }
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

  // ── Mode B: list all tracked orders ──────────────────────────────────────
  const page  = Math.max(1, parseInt(request.nextUrl.searchParams.get('page')  || '1', 10) || 1)
  const limit = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get('limit') || '50', 10) || 50, 1), 100)

  try {
    const res = await fetch(
      `${PP_BASE}/api/v2/tracking?page=${page}&limit=${limit}`,
      { headers: { 'x-parcelpanel-api-key': apiKey }, cache: 'no-store' }
    )

    if (!res.ok) {
      const body = await res.text()
      return NextResponse.json({ error: 'Parcel Panel API error', detail: body }, { status: 502 })
    }

    const data = await res.json()
    // PP may return orders under different keys
    const orders = data.orders ?? data.trackings ?? data.data ?? data ?? []
    return NextResponse.json({ orders: Array.isArray(orders) ? orders : [] })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to reach Parcel Panel' }, { status: 500 })
  }
}
