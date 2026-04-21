import { getUserFromToken, supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

const SCOPES = [
  // Orders
  'read_orders',
  'write_orders',
  'read_all_orders',
  'read_draft_orders',
  'write_draft_orders',
  'read_returns',
  'write_returns',
  // Fulfillment
  'read_fulfillments',
  'write_fulfillments',
  'read_assigned_fulfillment_orders',
  'write_assigned_fulfillment_orders',
  'read_merchant_managed_fulfillment_orders',
  'write_merchant_managed_fulfillment_orders',
  'read_third_party_fulfillment_orders',
  'write_third_party_fulfillment_orders',
  // Customers
  'read_customers',
  'write_customers',
  // Products & inventory
  'read_products',
  'write_products',
  'read_inventory',
  'write_inventory',
  'read_product_listings',
  // Subscriptions (Kaching / Recharge)
  'read_purchase_options',
  'write_purchase_options',
  // Discounts & pricing
  'read_price_rules',
  'write_price_rules',
  'read_discounts',
  'write_discounts',
  'read_gift_cards',
  'write_gift_cards',
  // Analytics & reports
  'read_analytics',
  'read_reports',
  'write_reports',
  // Checkouts & payments
  'read_checkouts',
  'write_checkouts',
  'read_payment_terms',
  'write_payment_terms',
  // Marketing
  'read_marketing_events',
  'write_marketing_events',
  // Shipping & locations
  'read_shipping',
  'write_shipping',
  'read_locations',
  // Store content
  'read_content',
  'write_content',
  'read_themes',
  'write_themes',
  'read_files',
  'write_files',
  'read_translations',
  'write_translations',
  'read_metaobjects',
  'write_metaobjects',
  // Pixels & script tags
  'read_pixels',
  'write_pixels',
  'read_script_tags',
  'write_script_tags',
  // Misc
  'read_legal_policies',
  'read_locales',
  'write_locales',
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

  const { error: stateError } = await supabaseAdmin.from('oauth_states').insert({
    state,
    user_id: user.id,
    shop: shopDomain,
    client_id: clientId,
    client_secret: clientSecret,
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
