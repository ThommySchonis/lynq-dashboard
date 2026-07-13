import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'
import {
  normalizeShopDomain,
  isValidShopDomain,
  verifyShopifyHmac,
  buildInstallAuthUrl,
} from '@/lib/services/shopify-install'
import { CANONICAL_SHOPIFY_SCOPES } from '@/lib/shopify-scopes'

// OAuth-first install entry. Shopify (App Store "Add app" / classic install)
// redirects the merchant here with ?shop=&hmac=&host=&timestamp=. We verify
// HMAC and immediately start the authorization code grant — no login wall,
// no manual shop entry (requirements 2.3.1 / 2.3.2 / 2.3.3).
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const clientId = process.env.SHOPIFY_CLIENT_ID
  // Shopify signs the install redirect with the secret paired to SHOPIFY_CLIENT_ID
  // — the same SHOPIFY_CLIENT_SECRET the callback uses for HMAC + token exchange.
  // Accept SHOPIFY_CLIENT_SECRET_PUB too so this entry can't 401 while the callback
  // passes (or vice-versa) if the public-app secret is the live one.
  const mainSecret = process.env.SHOPIFY_CLIENT_SECRET
  const pubSecret = process.env.SHOPIFY_CLIENT_SECRET_PUB
  if (!appUrl || !clientId || (!mainSecret && !pubSecret)) {
    logger.error('[shopify/install]', 'missing env', {
      appUrl: !!appUrl,
      clientId: !!clientId,
      secret: !!(mainSecret || pubSecret),
    })
    return NextResponse.json({ error: 'Shopify app not configured' }, { status: 500 })
  }

  const rawShop = url.searchParams.get('shop')
  if (!rawShop) return NextResponse.json({ error: 'shop is required' }, { status: 400 })

  const shop = normalizeShopDomain(rawShop)
  if (!isValidShopDomain(shop)) {
    return NextResponse.json({ error: 'invalid shop domain' }, { status: 400 })
  }

  // If Shopify signed this request, verify it (accept either configured secret).
  // Under managed installation the app-load entry may arrive without an `hmac`
  // (Shopify grants scopes without calling the app), so a MISSING hmac is not an
  // error — we still start OAuth. The callback fully enforces hmac + state +
  // code exchange, which is where install security actually lives. We only
  // reject an hmac that is PRESENT but invalid (a tampered/forged signature).
  if (url.searchParams.has('hmac')) {
    const hmacOk =
      (!!mainSecret && verifyShopifyHmac(url.searchParams, mainSecret)) ||
      (!!pubSecret && verifyShopifyHmac(url.searchParams, pubSecret))
    if (!hmacOk) {
      logger.warn('[shopify/install]', 'hmac verification failed', { shop })
      return NextResponse.json({ error: 'invalid hmac' }, { status: 401 })
    }
  }

  const state = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  // user_id = null → callback treats this as an install (provision identity).
  const { error: stateError } = await supabaseAdmin.from('oauth_states').insert({
    state,
    user_id: null,
    workspace_id: null,
    shop,
    expires_at: expiresAt,
  })
  if (stateError) {
    logger.error('[shopify/install]', 'oauth_states insert failed', { error: stateError.message })
    return NextResponse.json({ error: 'Failed to initiate install' }, { status: 500 })
  }

  const authUrl = buildInstallAuthUrl({ shop, appUrl, clientId, scopes: CANONICAL_SHOPIFY_SCOPES, state })
  // 302 (per the install contract); NextResponse.redirect defaults to 307 otherwise.
  return NextResponse.redirect(authUrl, 302)
}
