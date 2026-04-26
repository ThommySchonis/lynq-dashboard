import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const userId = searchParams.get('state')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!code || !userId) {
    return NextResponse.redirect(`${appUrl}/onboarding?error=gmail_failed`)
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  const redirectUri = `${appUrl}/api/auth/gmail/callback`

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  })

  const tokens = await tokenRes.json()
  if (!tokens.access_token) {
    return NextResponse.redirect(`${appUrl}/onboarding?error=gmail_token_failed`)
  }

  // Get Gmail address
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const profile = await profileRes.json()

  // Save tokens
  const { error } = await supabaseAdmin.from('gmail_tokens').upsert({
    user_id: userId,
    email: profile.email,
    gmail_address: profile.email,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  }, { onConflict: 'user_id' })

  if (error) {
    return NextResponse.redirect(`${appUrl}/onboarding?error=gmail_save_failed`)
  }

  return NextResponse.redirect(`${appUrl}/onboarding?step=3&gmail=connected`)
}
