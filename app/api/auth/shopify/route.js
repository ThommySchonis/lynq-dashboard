import { getUserFromToken, supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

const SCOPES = [
  // Orders — read, write, cancel, refund, note
  'read_orders',
  'write_orders',
  'read_all_orders',
  // Draft orders — duplicate order flow
  'read_draft_orders',
  'write_draft_orders',
  // Order edits — edit line item quantities
  'read_order_edits',
  'write_order_edits',
  // Fulfillment
  'read_fulfillments',
  'write_fulfillments',
  'read_assigned_fulfillment_orders',
  'write_assigned_fulfillment_orders',
  'read_merchant_managed_fulfillment_orders',
  'write_merchant_managed_fulfillment_orders',
  // Customers — read profile, update address
  'read_customers',
  'write_customers',
  // Products — line items in orders
  'read_products',
].join(',')

export async function OPTIONS() {
  return new Response(null, { status: 204 })
}

// POST /api/auth/shopify
// Body: { shop }
// Uses shared Lynq Partner App credentials — no per-client credentials needed
export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = process.env.SHOPIFY_CLIENT_ID
  if (!clientId) return NextResponse.json({ error: 'Shopify app not configured' }, { status: 500 })

  const { shop } = await request.json()
  if (!shop) {
    return NextResponse.json({ error: 'Shop domain is required' }, { status: 400 })
  }

  const shopDomain = shop.includes('.myshopify.com')
    ? shop.toLowerCase().trim()
    : `${shop.toLowerCase().trim()}.myshopify.com`

  const state = crypto.randomBytes(16).toString('hex')
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  const { error: stateError } = await supabaseAdmin.from('oauth_states').insert({
    state,
    user_id: user.id,
    shop: shopDomain,
    expires_at: expiresAt,
  })

  if (stateError) {
    console.error('oauth_states insert failed:', stateError)
    return NextResponse.json({ error: 'Failed to initiate OAuth: ' + stateError.message }, { status: 500 })
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/shopify/callback`

  const authUrl = `https://${shopDomain}/admin/oauth/authorize?` + new URLSearchParams({
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state,
  }).toString()

  return NextResponse.json({ url: authUrl })
}
