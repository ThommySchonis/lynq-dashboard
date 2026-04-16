import { getUserFromToken } from '../../../../../../lib/supabaseAdmin'
import { getShopifyClient, shopifyFetch } from '../../../../../../lib/shopify'
import { NextResponse } from 'next/server'

export async function PUT(request, { params }) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await getShopifyClient(user.email)
  if (!client) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { id } = await params
  const { firstName, lastName, address1, address2, city, zip, country, countryCode, phone } = await request.json()

  const res = await shopifyFetch(client, `/orders/${id}.json`, {
    method: 'PUT',
    body: JSON.stringify({
      order: {
        id,
        shipping_address: {
          first_name: firstName,
          last_name: lastName,
          address1,
          address2: address2 || '',
          city,
          zip,
          country: country || '',
          country_code: countryCode || '',
          phone: phone || '',
        },
      },
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    return NextResponse.json({ error: data.errors || 'Address update failed' }, { status: 502 })
  }

  return NextResponse.json({
    success: true,
    shippingAddress: data.order?.shipping_address,
  })
}
