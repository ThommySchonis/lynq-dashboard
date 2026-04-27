import { getUserFromToken } from '../../../../../../lib/supabaseAdmin'
import { getShopifyClient, shopifyFetch } from '../../../../../../lib/shopify'
import { NextResponse } from 'next/server'

export async function POST(request, { params }) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await getShopifyClient(user.id, user.email)
  if (!client) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { id } = await params
  const { trackingNumber, trackingCompany, trackingUrl, notify } = await request.json()

  // Get fulfillment orders for this order
  const foRes = await shopifyFetch(client, `/orders/${id}/fulfillment_orders.json`)
  if (!foRes.ok) return NextResponse.json({ error: 'Could not fetch fulfillment orders' }, { status: 502 })

  const { fulfillment_orders } = await foRes.json()
  const open = (fulfillment_orders || []).filter(fo => fo.status === 'open' || fo.status === 'in_progress')
  if (!open.length) return NextResponse.json({ error: 'No open fulfillment found' }, { status: 400 })

  const body = {
    fulfillment: {
      line_items_by_fulfillment_order: open.map(fo => ({ fulfillment_order_id: fo.id })),
      notify_customer: notify !== false,
      tracking_info: trackingNumber ? {
        number: trackingNumber,
        company: trackingCompany || '',
        url: trackingUrl || '',
      } : undefined,
    },
  }

  const res = await shopifyFetch(client, '/fulfillments.json', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (!res.ok) return NextResponse.json({ error: data.errors || 'Fulfillment failed' }, { status: 502 })

  return NextResponse.json({ success: true, fulfillment: { id: data.fulfillment?.id, status: data.fulfillment?.status } })
}
