import { getUserFromToken } from '../../../../lib/supabaseAdmin'
import { getShopifyClient, shopifyFetch } from '../../../../lib/shopify'
import { NextResponse } from 'next/server'

// Wrapper route: Lovable calls POST /shopify/cancel-order with { orderId, ...params }
export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await getShopifyClient(user.id, user.email)
  if (!client) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { orderId, reason, restock, refund, notify } = await request.json()
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  const body = {
    reason: reason || 'customer',
    restock: restock !== false,
    email: notify !== false,
  }

  if (refund) {
    body.refund = { shipping: { full_refund: true }, refund_line_items: [] }
  }

  const res = await shopifyFetch(client, `/orders/${orderId}/cancel.json`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (!res.ok) {
    return NextResponse.json({ error: data.errors || 'Cancel failed' }, { status: 502 })
  }

  return NextResponse.json({ success: true, order: { id: data.order?.id, cancelReason: data.order?.cancel_reason } })
}
