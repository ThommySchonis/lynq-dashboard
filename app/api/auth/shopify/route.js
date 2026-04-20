import { getUserFromToken, supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

const SCOPES = [
  'read_orders',
  'write_orders',
  'read_customers',
  'write_customers',
  'read_draft_orders',
  'write_draft_orders',
  'read_fulfillments',
  'write_fulfillments',
  'read_price_rules',
  'write_price_rules',
  'read_discounts',
  'write_discounts',
].join(',')

export async function OPTIONS() {
  return new Response(null, { status: 204 })
}

// POST /api/auth/shopify
// Body: { shop, clientId, clientSecret }
// Each client uses their own Shopify app credentials — no distribution restrictions
export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { shop, clientId, clientSecret } = await request.json()
  if (!shop || !clientId || !clientSecret) {
    return NextResponse.json({ error: 'Shop domain, Client ID and Client Secret are required' }, { status: 400 })
  }

  const shopDomain = shop.includes('.myshopify.com')
    ? shop.toLowerCase().trim()
    : `${shop.toLowerCase().trim()}.myshopify.com`

  const state = crypto.randomBytes(16).toString('hex')
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  await supabaseAdmin.from('oauth_states').upsert({
    state,
    user_id: user.id,
    shop: shopDomain,
    client_id: clientId,
    client_secret: clientSecret,
    expires_at: expiresAt,
  })

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/shopify/callback`

  const authUrl = `https://${shopDomain}/admin/oauth/authorize?` + new URLSearchParams({
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state,
  }).toString()

  return NextResponse.json({ url: authUrl })
}
