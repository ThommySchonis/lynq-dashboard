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
].join(',')

export async function OPTIONS() {
  return new Response(null, { status: 204 })
}

// POST /api/auth/shopify
// Body: { shop: "yourstore.myshopify.com" }
// Returns: { url } — frontend does window.location.href = url
export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { shop } = await request.json()
  if (!shop) return NextResponse.json({ error: 'Missing shop' }, { status: 400 })

  const shopDomain = shop.includes('.myshopify.com')
    ? shop.toLowerCase().trim()
    : `${shop.toLowerCase().trim()}.myshopify.com`

  const state = crypto.randomBytes(16).toString('hex')
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  await supabaseAdmin.from('oauth_states').upsert({
    state,
    user_id: user.id,
    shop: shopDomain,
    expires_at: expiresAt,
  })

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/shopify/callback`

  const authUrl = `https://${shopDomain}/admin/oauth/authorize?` + new URLSearchParams({
    client_id: process.env.SHOPIFY_CLIENT_ID,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state,
  }).toString()

  return NextResponse.json({ url: authUrl })
}
