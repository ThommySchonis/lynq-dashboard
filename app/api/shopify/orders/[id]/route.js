import { getUserFromToken } from '../../../../../lib/supabaseAdmin'
import { getShopifyClient, shopifyFetch } from '../../../../../lib/shopify'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await getShopifyClient(user.id)
  if (!client) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { id } = await params

  const res = await shopifyFetch(client, `/orders/${id}.json`)
  if (!res.ok) return NextResponse.json({ error: 'Shopify API error' }, { status: 502 })

  const { order } = await res.json()

  return NextResponse.json({
    id: order.id,
    name: order.name,
    createdAt: order.created_at,
    financialStatus: order.financial_status,
    fulfillmentStatus: order.fulfillment_status || 'unfulfilled',
    cancelReason: order.cancel_reason,
    cancelledAt: order.cancelled_at,
    customer: order.customer ? {
      id: order.customer.id,
      firstName: order.customer.first_name,
      lastName: order.customer.last_name,
      email: order.customer.email,
      phone: order.customer.phone,
      ordersCount: order.customer.orders_count,
      totalSpent: order.customer.total_spent,
    } : null,
    shippingAddress: order.shipping_address || null,
    billingAddress: order.billing_address || null,
    lineItems: (order.line_items || []).map(item => ({
      id: item.id,
      title: item.title,
      variantTitle: item.variant_title,
      sku: item.sku,
      quantity: item.quantity,
      price: item.price,
      total: (parseFloat(item.price) * item.quantity).toFixed(2),
    })),
    subtotalPrice: order.subtotal_price,
    totalShippingPrice: order.total_shipping_price_set?.shop_money?.amount || '0.00',
    totalTax: order.total_tax,
    totalPrice: order.total_price,
    currency: order.currency,
    refunds: order.refunds || [],
    fulfillments: (order.fulfillments || []).map(f => ({
      id: f.id,
      status: f.status,
      trackingNumber: f.tracking_number,
      trackingUrl: f.tracking_url,
      trackingCompany: f.tracking_company,
    })),
    tags: order.tags,
    note: order.note,
  })
}
