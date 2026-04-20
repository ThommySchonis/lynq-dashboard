import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const hmac = searchParams.get('hmac')
  const shop = searchParams.get('shop')
  const state = searchParams.get('state')

  const appUrl = process.env.LOVABLE_APP_URL || process.env.NEXT_PUBLIC_APP_URL

  // Look up state in Supabase instead of cookies (works cross-origin)
  const { data: oauthState } = await supabaseAdmin
    .from('oauth_states')
    .select('*')
    .eq('state', state)
    .eq('shop', shop)
    .maybeSingle()

  if (!oauthState || new Date(oauthState.expires_at) < new Date()) {
    return NextResponse.redirect(`${appUrl}/settings?error=invalid_state`)
  }

  // Verify HMAC signature from Shopify
  const params = Object.fromEntries(searchParams.entries())
  delete params.hmac
  const message = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&')
  const digest = crypto
    .createHmac('sha256', process.env.SHOPIFY_CLIENT_SECRET)
    .update(message)
    .digest('hex')

  if (digest !== hmac) {
    return NextResponse.redirect(`${appUrl}/settings?error=invalid_hmac`)
  }

  // Exchange code for permanent access token
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      code,
    }),
  })

  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    return NextResponse.redirect(`${appUrl}/settings?error=token_exchange_failed`)
  }

  // Save to integrations table
  await supabaseAdmin.from('integrations').upsert({
    user_id: oauthState.user_id,
    shopify_domain: shop,
    shopify_access_token: tokenData.access_token,
    shopify_scope: tokenData.scope,
    connected_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  // Clean up used state
  await supabaseAdmin.from('oauth_states').delete().eq('state', state)

  return NextResponse.redirect(`${appUrl}/settings?shopify=connected`)
}
