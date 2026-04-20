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

  // Look up state — includes client credentials stored per user
  const { data: oauthState } = await supabaseAdmin
    .from('oauth_states')
    .select('*')
    .eq('state', state)
    .eq('shop', shop)
    .maybeSingle()

  if (!oauthState || new Date(oauthState.expires_at) < new Date()) {
    return NextResponse.redirect(`${appUrl}/settings?error=invalid_state`)
  }

  // Use client credentials from oauth_states (per-client app credentials)
  const clientId = oauthState.client_id || process.env.SHOPIFY_CLIENT_ID
  const clientSecret = oauthState.client_secret || process.env.SHOPIFY_CLIENT_SECRET

  // Verify HMAC signature
  const params = Object.fromEntries(searchParams.entries())
  delete params.hmac
  const message = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&')
  const digest = crypto
    .createHmac('sha256', clientSecret)
    .update(message)
    .digest('hex')

  if (digest !== hmac) {
    return NextResponse.redirect(`${appUrl}/settings?error=invalid_hmac`)
  }

  // Exchange code for access token using client's own credentials
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  })

  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    return NextResponse.redirect(`${appUrl}/settings?error=token_exchange_failed`)
  }

  // Save to integrations table
  const { error: upsertError } = await supabaseAdmin.from('integrations').upsert({
    client_id: oauthState.user_id,
    shopify_domain: shop,
    shopify_access_token: tokenData.access_token,
    shopify_scope: tokenData.scope,
    shopify_connected_at: new Date().toISOString(),
  }, { onConflict: 'client_id' })

  if (upsertError) {
    console.error('integrations upsert failed:', JSON.stringify(upsertError))
    return new Response(`
      <html><body style="font-family:monospace;padding:40px;background:#1a1a1a;color:#ff6b6b">
        <h2>Shopify save failed</h2>
        <p><b>Error:</b> ${upsertError.message}</p>
        <p><b>Code:</b> ${upsertError.code}</p>
        <p><b>Details:</b> ${upsertError.details || 'none'}</p>
        <p><b>user_id:</b> ${oauthState.user_id}</p>
        <p><b>shop:</b> ${shop}</p>
        <p style="margin-top:20px"><a href="${appUrl}/settings" style="color:#888">← Back to settings</a></p>
      </body></html>
    `, { status: 500, headers: { 'Content-Type': 'text/html' } })
  }

  await supabaseAdmin.from('oauth_states').delete().eq('state', state)

  return NextResponse.redirect(`${appUrl}/settings?shopify=connected`)
}
