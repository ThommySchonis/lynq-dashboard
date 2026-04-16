import { getUserFromToken } from '../../../../lib/supabaseAdmin'
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

// GET /api/auth/shopify?shop=yourstore.myshopify.com
// Starts the OAuth flow — redirects merchant to Shopify authorization page
export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const shop = searchParams.get('shop')?.toLowerCase().trim()

  if (!shop) return NextResponse.json({ error: 'Missing shop parameter' }, { status: 400 })

  // Normalize: add .myshopify.com if not present
  const shopDomain = shop.includes('.myshopify.com') ? shop : `${shop}.myshopify.com`

  // Generate a random state to prevent CSRF
  const state = crypto.randomBytes(16).toString('hex')

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/shopify/callback`
  const clientId = process.env.SHOPIFY_CLIENT_ID

  const authUrl = `https://${shopDomain}/admin/oauth/authorize?` + new URLSearchParams({
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state,
    'grant_options[]': 'per-user',
  }).toString()

  // Store state + user_id in a short-lived cookie so callback can verify
  const response = NextResponse.redirect(authUrl)
  response.cookies.set('shopify_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
  })
  response.cookies.set('shopify_oauth_user', user.id, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
  })
  response.cookies.set('shopify_oauth_shop', shopDomain, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
  })

  return response
}
