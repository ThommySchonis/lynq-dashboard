import { getUserFromToken } from '../../../../../../lib/supabaseAdmin'
import { getShopifyClient, shopifyFetch } from '../../../../../../lib/shopify'
import { NextResponse } from 'next/server'

export async function POST(request, { params }) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await getShopifyClient(user.id)
  if (!client) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { id } = await params
  const { keepAddress, applyDiscount, note, tags } = await request.json()

  // Fetch original order to copy line items + customer
  const orderRes = await shopifyFetch(client, `/orders/${id}.json`)
  if (!orderRes.ok) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const { order } = await orderRes.json()

  const lineItems = (order.line_items || []).map(item => ({
    variant_id: item.variant_id,
    quantity: item.quantity,
    ...(applyDiscount && item.discount_allocations?.length
      ? { applied_discount: { value: item.discount_allocations[0]?.amount, value_type: 'fixed_amount', title: 'Duplicated discount' } }
      : {}),
  })).filter(item => item.variant_id)

  const draftOrder = {
    line_items: lineItems,
    customer: order.customer ? { id: order.customer.id } : undefined,
    note: note || `Duplicated from ${order.name}`,
    tags: tags || order.tags,
  }

  if (keepAddress !== false && order.shipping_address) {
    draftOrder.shipping_address = order.shipping_address
  }

  const res = await shopifyFetch(client, '/draft_orders.json', {
    method: 'POST',
    body: JSON.stringify({ draft_order: draftOrder }),
  })

  const data = await res.json()
  if (!res.ok) {
    return NextResponse.json({ error: data.errors || 'Duplicate failed' }, { status: 502 })
  }

  return NextResponse.json({
    success: true,
    draftOrder: {
      id: data.draft_order?.id,
      name: data.draft_order?.name,
      invoiceUrl: data.draft_order?.invoice_url,
    },
  })
}
