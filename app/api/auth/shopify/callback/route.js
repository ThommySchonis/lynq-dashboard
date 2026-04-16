import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

// GET /api/auth/shopify/callback?code=...&hmac=...&shop=...&state=...
// Shopify redirects here after merchant approves the app
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const hmac = searchParams.get('hmac')
  const shop = searchParams.get('shop')
  const state = searchParams.get('state')

  // Verify state matches cookie (CSRF protection)
  const cookieState = request.cookies.get('shopify_oauth_state')?.value
  const userId = request.cookies.get('shopify_oauth_user')?.value
  const cookieShop = request.cookies.get('shopify_oauth_shop')?.value

  if (!state || state !== cookieState) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/onboarding?error=invalid_state`
    )
  }

  if (!shop || shop !== cookieShop) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/onboarding?error=shop_mismatch`
    )
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
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/onboarding?error=invalid_hmac`
    )
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
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/onboarding?error=token_exchange_failed`
    )
  }

  // Save to integrations table in Supabase
  await supabaseAdmin
    .from('integrations')
    .upsert({
      user_id: userId,
      shopify_domain: shop,
      shopify_access_token: tokenData.access_token,
      shopify_scope: tokenData.scope,
      connected_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  // Clear OAuth cookies
  const response = NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}/onboarding?step=3&shopify=connected`
  )
  response.cookies.delete('shopify_oauth_state')
  response.cookies.delete('shopify_oauth_user')
  response.cookies.delete('shopify_oauth_shop')

  return response
}
