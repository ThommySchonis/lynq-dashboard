import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { encrypt } from '../../../../../lib/encryption'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyOAuthState } from '../../../../../lib/oauthState'
import { parseJson } from '@/lib/utils/typed-json'

interface OAuthTokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
}

interface OutlookProfileResponse {
  mail?: string
  userPrincipalName?: string
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const oauthState = verifyOAuthState(searchParams.get('state'), 'outlook')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!code || !oauthState) {
    return NextResponse.redirect(`${appUrl}/settings?provider=outlook&status=error`)
  }

  const { userId, workspaceId, storeId } = oauthState

  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  const redirectUri = `${appUrl}/api/auth/outlook/callback`
  const tenantId = 'common'

  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId!,
      client_secret: clientSecret!,
      redirect_uri: redirectUri!,
      grant_type: 'authorization_code',
    }),
  })

  const tokens = await parseJson<OAuthTokenResponse>(tokenRes)
  if (!tokens.access_token) {
    return NextResponse.redirect(`${appUrl}/settings?provider=outlook&status=error&reason=token_failed`)
  }

  const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const profile = await parseJson<OutlookProfileResponse>(profileRes)
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
    expires_at: new Date(Date.now() + (tokens.expires_in ?? 0) * 1000).toISOString(),
    store_id: storeId || null,
    status: 'active',
    is_default: isDefault,
  }

  const { error: emailAccountError } = await supabaseAdmin
    .from('email_accounts')
    .upsert(emailAccountRecord, { onConflict: 'workspace_id,provider,email_address' })

  if (emailAccountError) {
    console.error('[outlook/callback] email_accounts upsert error:', emailAccountError.message)
    return NextResponse.redirect(`${appUrl}/settings?provider=outlook&status=error&reason=save_failed`)
  }

  return NextResponse.redirect(`${appUrl}/settings?provider=outlook&status=connected`)
}
