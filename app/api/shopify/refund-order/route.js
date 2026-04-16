import { getUserFromToken } from '../../../../lib/supabaseAdmin'
import { getShopifyClient, shopifyFetch } from '../../../../lib/shopify'
import { NextResponse } from 'next/server'

// Wrapper route: Lovable calls POST /shopify/refund-order with { orderId, ...params }
export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await getShopifyClient(user.id)
  if (!client) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { orderId, lineItems, restock, notify, reason, shipping } = await request.json()
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  const refundLineItems = (lineItems || []).map(item => ({
    line_item_id: item.lineItemId,
    quantity: item.quantity,
    restock_type: restock ? 'return' : 'no_restock',
  }))

  const calcRes = await shopifyFetch(
    client,
    `/orders/${orderId}/refunds/calculate.json`,
    {
      method: 'POST',
      body: JSON.stringify({
        refund: {
          shipping: { full_refund: !!shipping },
          refund_line_items: refundLineItems,
        },
      }),
    }
  )

  const calcData = await calcRes.json()
  if (!calcRes.ok) {
    return NextResponse.json({ error: calcData.errors || 'Calculation failed' }, { status: 502 })
  }

  const transactions = (calcData.refund?.transactions || []).map(t => ({
    parent_id: t.parent_id,
    amount: t.amount,
    kind: 'refund',
    gateway: t.gateway,
  }))

  const refundRes = await shopifyFetch(
    client,
    `/orders/${orderId}/refunds.json`,
    {
      method: 'POST',
      body: JSON.stringify({
        refund: {
          notify: notify !== false,
          note: reason || '',
          shipping: { full_refund: !!shipping },
          refund_line_items: refundLineItems,
          transactions,
        },
      }),
    }
  )

  const refundData = await refundRes.json()
  if (!refundRes.ok) {
    return NextResponse.json({ error: refundData.errors || 'Refund failed' }, { status: 502 })
  }

  return NextResponse.json({ success: true, refund: refundData.refund })
}
