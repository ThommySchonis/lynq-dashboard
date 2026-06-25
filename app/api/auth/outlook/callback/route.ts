import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { encrypt } from '@/lib/encryption'
import { verifyOAuthState } from '@/lib/oauthState'
import { safeReturnOrigin } from '@/lib/utils/request'
import { logger } from '@/lib/logger'

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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/settings?provider=outlook&status=error`)
  }

  const oauthState = verifyOAuthState(state, 'outlook')
  if (!oauthState) {
    return NextResponse.redirect(`${appUrl}/settings?provider=outlook&status=error`)
  }

  const { userId, workspaceId, storeId } = oauthState
  // Return the user to whichever domain they started the connect on.
  const base = safeReturnOrigin(oauthState.returnOrigin)

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

  const tokens = (await tokenRes.json()) as OAuthTokenResponse
  if (!tokens.access_token) {
    return NextResponse.redirect(`${base}/settings?provider=outlook&status=error&reason=token_failed`)
  }

  const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const profile = (await profileRes.json()) as OutlookProfileResponse
  const emailAddress = profile.mail || profile.userPrincipalName

  const encryptedAccessToken = encrypt(tokens.access_token)
  const encryptedRefreshToken = tokens.refresh_token ? encrypt(tokens.refresh_token) : null

  let isDefault = false
  if (workspaceId) {
    const { count } = await supabaseAdmin
      .from('email_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
    isDefault = count === 0
  }

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
    logger.error('[outlook/callback]', 'email_accounts upsert error', { error: emailAccountError.message })
    return NextResponse.redirect(`${base}/settings?provider=outlook&status=error&reason=save_failed`)
  }

  return NextResponse.redirect(`${base}/settings?provider=outlook&status=connected`)
}
