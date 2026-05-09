import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { encrypt } from '../../../../../lib/encryption'
import { NextResponse } from 'next/server'
import { verifyOAuthState } from '../../../../../lib/oauthState'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const oauthState = verifyOAuthState(searchParams.get('state'), 'outlook')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!code || !oauthState) {
    return NextResponse.redirect(`${appUrl}/settings?provider=outlook&status=error`)
  }

  const { userId, workspaceId } = oauthState

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
    return NextResponse.redirect(`${appUrl}/settings?provider=outlook&status=error&reason=token_failed`)
  }

  const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const profile = await profileRes.json()
  const emailAddress = profile.mail || profile.userPrincipalName

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
    provider: 'outlook',
    email_address: emailAddress,
    display_name: emailAddress,
    access_token: encryptedAccessToken,
    refresh_token: encryptedRefreshToken,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    status: 'active',
    is_default: isDefault,
  }

  const { error: emailAccountError } = await supabaseAdmin
    .from('email_accounts')
    .upsert(emailAccountRecord, { onConflict: 'workspace_id,provider,email_address' })

  if (emailAccountError) {
    console.error('[outlook/callback] email_accounts upsert error:', emailAccountError.message)
  }

  // LEGACY dual-write: keep writing to outlook_tokens for backwards compatibility
  const { error: legacyError } = await supabaseAdmin.from('outlook_tokens').upsert({
    user_id: userId,
    email: emailAddress,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  }, { onConflict: 'user_id' })

  if (legacyError) {
    console.error('[outlook/callback] outlook_tokens legacy upsert error:', legacyError.message)
  }

  if (emailAccountError && legacyError) {
    return NextResponse.redirect(`${appUrl}/settings?provider=outlook&status=error&reason=save_failed`)
  }

  return NextResponse.redirect(`${appUrl}/settings?provider=outlook&status=connected`)
}
