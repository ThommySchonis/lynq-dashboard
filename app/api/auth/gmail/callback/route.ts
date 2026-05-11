import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { encrypt } from '../../../../../lib/encryption'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyOAuthState } from '../../../../../lib/oauthState'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  const verifiedState = verifyOAuthState(state, 'gmail')

  if (!code || !verifiedState) {
    return NextResponse.redirect(`${appUrl}/settings?provider=gmail&status=error`)
  }

  const { userId, workspaceId } = verifiedState

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  const redirectUri = `${appUrl}/api/auth/gmail/callback`

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId!, client_secret: clientSecret!, redirect_uri: redirectUri!, grant_type: 'authorization_code' }),
  })

  const tokens = await tokenRes.json() as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
  }
  if (!tokens.access_token) {
    return NextResponse.redirect(`${appUrl}/settings?provider=gmail&status=error&reason=token_failed`)
  }

  // Get Gmail address
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const profile = await profileRes.json() as { email?: string }
  const emailAddress = profile.email

  // Encrypt tokens
  const encryptedAccessToken = encrypt(tokens.access_token)
  const encryptedRefreshToken = tokens.refresh_token ? encrypt(tokens.refresh_token) : null

  // Check if this is the first email account for the workspace (to set is_default)
  let isDefault = false
  if (workspaceId) {
    const { count } = await supabaseAdmin
      .from('email_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
    isDefault = count === 0
  }

  // NEW: write to unified email_accounts table
  const emailAccountRecord = {
    client_id: userId,
    workspace_id: workspaceId,
    provider: 'gmail',
    email_address: emailAddress,
    display_name: emailAddress,
    access_token: encryptedAccessToken,
    refresh_token: encryptedRefreshToken,
    expires_at: new Date(Date.now() + (tokens.expires_in ?? 0) * 1000).toISOString(),
    status: 'active',
    is_default: isDefault,
  }

  const { error: emailAccountError } = await supabaseAdmin
    .from('email_accounts')
    .upsert(emailAccountRecord, { onConflict: 'workspace_id,provider,email_address' })

  if (emailAccountError) {
    console.error('[gmail/callback] email_accounts upsert error:', emailAccountError.message)
  }

  // LEGACY dual-write: keep writing to gmail_tokens for backwards compatibility
  const { error: legacyError } = await supabaseAdmin.from('gmail_tokens').upsert({
    user_id: userId,
    email: emailAddress,
    gmail_address: emailAddress,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(Date.now() + (tokens.expires_in ?? 0) * 1000).toISOString(),
  }, { onConflict: 'user_id' })

  if (legacyError) {
    console.error('[gmail/callback] gmail_tokens legacy upsert error:', legacyError.message)
  }

  if (emailAccountError && legacyError) {
    return NextResponse.redirect(`${appUrl}/settings?provider=gmail&status=error&reason=save_failed`)
  }

  return NextResponse.redirect(`${appUrl}/settings?provider=gmail&status=connected`)
}
