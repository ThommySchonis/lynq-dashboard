import { getUserFromToken } from '../../../../lib/supabaseAdmin'
import { getShopifyClient, shopifyFetch } from '../../../../lib/shopify'
import { NextResponse } from 'next/server'

// GET /api/shopify/customer?email=...  or  ?order=...
// Returns customer info + their recent orders
export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await getShopifyClient(user.id, user.email)
  if (!client) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  const order = searchParams.get('order')

  if (!email && !order) {
    return NextResponse.json({ error: 'Missing email or order' }, { status: 400 })
  }

  let customer = null

  if (email) {
    // Search customer by email
    const searchRes = await shopifyFetch(
      client,
      `/customers/search.json?query=email:${encodeURIComponent(email)}&limit=1`
    )
    const searchData = await searchRes.json()
    customer = searchData.customers?.[0]
  } else if (order) {
    // Search by order number — strip leading #
    const orderName = order.replace(/^#/, '')
    const orderRes = await shopifyFetch(
      client,
      `/orders.json?name=${encodeURIComponent(orderName)}&status=any&limit=1`
    )
    const orderData = await orderRes.json()
    const matchedOrder = orderData.orders?.[0]
    if (matchedOrder?.customer?.id) {
      // Fetch the full customer record
      const custRes = await shopifyFetch(client, `/customers/${matchedOrder.customer.id}.json`)
      const custData = await custRes.json()
      customer = custData.customer
    }
  }

  if (!customer) return NextResponse.json({ customer: null, orders: [] })

  // Fetch their recent orders (limit 50 for better refund rate accuracy)
  const ordersRes = await shopifyFetch(
    client,
    `/orders.json?customer_id=${customer.id}&status=any&limit=50`
  )
  const ordersData = await ordersRes.json()

  const orders = (ordersData.orders || []).map(o => ({
    id: o.id,
    name: o.name,
    createdAt: o.created_at,
    financialStatus: o.financial_status,
    fulfillmentStatus: o.fulfillment_status || 'unfulfilled',
    cancelReason: o.cancel_reason,
    cancelledAt: o.cancelled_at || null,
    totalPrice: o.total_price,
    currency: o.currency,
    lineItems: (o.line_items || []).map(item => ({
      id: item.id,
      title: item.title,
      variantTitle: item.variant_title,
      sku: item.sku,
      quantity: item.quantity,
      price: item.price,
    })),
    fulfillments: (o.fulfillments || []).map(f => ({
      trackingNumber: f.tracking_number,
      trackingUrl: f.tracking_url,
      trackingCompany: f.tracking_company,
      status: f.status,
    })),
    refunds: o.refunds || [],
    shippingAddress: o.shipping_address ? {
      firstName: o.shipping_address.first_name || '',
      lastName: o.shipping_address.last_name || '',
      address1: o.shipping_address.address1 || '',
      address2: o.shipping_address.address2 || '',
      city: o.shipping_address.city || '',
      zip: o.shipping_address.zip || '',
      country: o.shipping_address.country || '',
      countryCode: o.shipping_address.country_code || '',
      phone: o.shipping_address.phone || '',
    } : null,
  }))

  return NextResponse.json({
    customer: {
      id: customer.id,
      firstName: customer.first_name,
      lastName: customer.last_name,
      email: customer.email,
      phone: customer.phone,
      city: customer.default_address?.city,
      country: customer.default_address?.country,
      countryCode: customer.default_address?.country_code,
      ordersCount: customer.orders_count,
      totalSpent: customer.total_spent,
      currency: customer.currency,
      tags: customer.tags,
      note: customer.note,
      createdAt: customer.created_at,
    },
    orders,
  })
}
