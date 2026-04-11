import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect('https://lynq-dashboard.vercel.app/dashboard.html?gmail=error')
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  const redirectUri = 'https://lynq-dashboard.vercel.app/api/auth/gmail/callback'

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
  if (!tokens.access_token) {
    return NextResponse.redirect('https://lynq-dashboard.vercel.app/dashboard.html?gmail=error')
  }

  // Get Gmail address
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const profile = await profileRes.json()

  // Store tokens in Supabase
  await supabaseAdmin.from('gmail_tokens').upsert({
    email: profile.email,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    gmail_address: profile.email,
  }, { onConflict: 'email' })

  return NextResponse.redirect('https://lynq-dashboard.vercel.app/dashboard.html?gmail=connected')
}
