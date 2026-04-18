import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const userId = searchParams.get('state')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const lovableUrl = process.env.LOVABLE_APP_URL || appUrl

  if (!code || !userId) {
    return NextResponse.redirect(`${lovableUrl}/settings?outlook=error`)
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  const redirectUri = `${appUrl}/api/auth/outlook/callback`
  const tenantId = 'common'

  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
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
    return NextResponse.redirect(`${appUrl}/settings?outlook=error&reason=token_failed`)
  }

  const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const profile = await profileRes.json()
  const email = profile.mail || profile.userPrincipalName

  const { error } = await supabaseAdmin.from('outlook_tokens').upsert({
    user_id: userId,
    email,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  }, { onConflict: 'user_id' })

  if (error) {
    return NextResponse.redirect(`${lovableUrl}/settings?outlook=error&reason=save_failed`)
  }

  return NextResponse.redirect(`${lovableUrl}/settings?outlook=connected`)
}
