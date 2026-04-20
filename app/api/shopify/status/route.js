import { getUserFromToken } from '../../../../lib/supabaseAdmin'
import { getShopifyCredentials } from '../../../../lib/shopifyCredentials'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ connected: false })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ connected: false })

  const client = await getShopifyCredentials(user.id, user.email)
  if (!client) return NextResponse.json({ connected: false })

  return NextResponse.json({ connected: true, shop: client.shopify_domain || client.domain })
}
