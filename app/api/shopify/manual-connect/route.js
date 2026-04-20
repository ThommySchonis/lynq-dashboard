import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { shop, accessToken } = await request.json()
  if (!shop || !accessToken) {
    return NextResponse.json({ error: 'Shop domain and access token are required' }, { status: 400 })
  }

  const shopDomain = shop.includes('.myshopify.com')
    ? shop.toLowerCase().trim()
    : `${shop.toLowerCase().trim()}.myshopify.com`

  // Verify the token actually works before saving
  const testRes = await fetch(
    `https://${shopDomain}/admin/api/2024-01/shop.json`,
    { headers: { 'X-Shopify-Access-Token': accessToken } }
  )

  if (!testRes.ok) {
    return NextResponse.json({ error: 'Invalid token or store domain. Please check your credentials.' }, { status: 400 })
  }

  await supabaseAdmin.from('integrations').upsert({
    user_id: user.id,
    shopify_domain: shopDomain,
    shopify_access_token: accessToken,
    connected_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  return NextResponse.json({ success: true, shop: shopDomain })
}

export async function DELETE(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabaseAdmin.from('integrations').delete().eq('user_id', user.id)
  return NextResponse.json({ success: true })
}
