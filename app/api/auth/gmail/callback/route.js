import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const userId = searchParams.get('state') // Supabase user ID passed through OAuth state

  if (!code || !userId) {
    console.error('[Gmail callback] Missing code or state:', { code: !!code, userId: !!userId })
    return NextResponse.redirect('https://lynq-dashboard.vercel.app/dashboard.html?gmail=error&reason=missing_code')
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  const redirectUri = 'https://lynq-dashboard.vercel.app/api/auth/gmail/callback'

  if (!clientId || !clientSecret) {
    console.error('[Gmail callback] Missing Google env vars')
    return NextResponse.redirect('https://lynq-dashboard.vercel.app/dashboard.html?gmail=error&reason=missing_env')
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  const tokens = await tokenRes.json()
  console.log('[Gmail callback] Token exchange:', { access_token: !!tokens.access_token, error: tokens.error })

  if (!tokens.access_token) {
    console.error('[Gmail callback] Token exchange failed:', tokens)
    return NextResponse.redirect('https://lynq-dashboard.vercel.app/dashboard.html?gmail=error&reason=token_exchange_failed')
  }

  // Get Gmail address
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const profile = await profileRes.json()
  console.log('[Gmail callback] Gmail address:', profile.email, 'for user_id:', userId)

  // Store tokens keyed by Supabase user ID
  const { error: upsertError } = await supabaseAdmin.from('gmail_tokens').upsert({
    user_id: userId,
    email: profile.email,
    gmail_address: profile.email,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  }, { onConflict: 'user_id' })

  if (upsertError) {
    console.error('[Gmail callback] Supabase upsert failed:', upsertError)
    const msg = encodeURIComponent(upsertError.message || upsertError.code || 'unknown')
    return NextResponse.redirect(`https://lynq-dashboard.vercel.app/dashboard.html?gmail=error&reason=upsert_failed&msg=${msg}`)
  }

  console.log('[Gmail callback] Tokens saved for user_id:', userId)
  return NextResponse.redirect('https://lynq-dashboard.vercel.app/dashboard.html?gmail=connected')
}
