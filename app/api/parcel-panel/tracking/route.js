import { getUserFromToken, supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

const PP_BASE = 'https://open.parcelpanel.com'

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ordersParam = request.nextUrl.searchParams.get('orders') || ''
  const orderNumbers = ordersParam.split(',').map(o => o.trim()).filter(Boolean).slice(0, 20)

  if (!orderNumbers.length) return NextResponse.json({ orders: [] })

  // Get client's Parcel Panel API key
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('parcel_panel_api_key')
    .eq('email', user.email)
    .single()

  if (!client?.parcel_panel_api_key) {
    return NextResponse.json({ error: 'Parcel Panel not configured' }, { status: 404 })
  }

  const apiKey = client.parcel_panel_api_key

  // Fetch tracking for each order in parallel
  const results = await Promise.allSettled(
    orderNumbers.map(async (num) => {
      const orderNum = num.startsWith('#') ? num : `#${num}`
      try {
        const res = await fetch(
          `${PP_BASE}/api/v2/tracking/order?order_number=${encodeURIComponent(orderNum)}`,
          {
            headers: { 'x-parcelpanel-api-key': apiKey },
            next: { revalidate: 60 },
          }
        )
        if (!res.ok) return null
        const data = await res.json()
        return data.order || null
      } catch {
        return null
      }
    })
  )

  const orders = results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value)

  return NextResponse.json({ orders })
}
