import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { syncConversationsToAccountStore } from '@/lib/services/email-accounts'
import { encrypt } from '@/lib/encryption'
import { verifyOAuthState } from '@/lib/oauthState'
import { safeReturnOrigin } from '@/lib/utils/request'
import { logger } from '@/lib/logger'

interface OAuthTokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
}

interface GoogleProfileResponse {
  email?: string
}

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/settings?provider=gmail&status=error`)
  }

  const verifiedState = verifyOAuthState(state, 'gmail')
  if (!verifiedState) {
    return NextResponse.redirect(`${appUrl}/settings?provider=gmail&status=error`)
  }

  const { userId, workspaceId, storeId } = verifiedState
  // Return the user to whichever domain they started the connect on.
  const base = safeReturnOrigin(verifiedState.returnOrigin)

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  const redirectUri = `${appUrl}/api/auth/gmail/callback`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
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
    return NextResponse.redirect(`${base}/settings?provider=gmail&status=error&reason=token_failed`)
  }

  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const profile = (await profileRes.json()) as GoogleProfileResponse
  const emailAddress = profile.email

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
    provider: 'gmail',
    email_address: emailAddress,
    display_name: emailAddress,
    access_token: encryptedAccessToken,
    refresh_token: encryptedRefreshToken,
    expires_at: new Date(Date.now() + (tokens.expires_in ?? 0) * 1000).toISOString(),
    store_id: storeId || null,
    status: 'active',
    is_default: isDefault,
  }

  const { data: upsertedAccount, error: emailAccountError } = await supabaseAdmin
    .from('email_accounts')
    .upsert(emailAccountRecord, { onConflict: 'workspace_id,provider,email_address' })
    .select('id')
    .single<{ id: string }>()

  if (emailAccountError) {
    logger.error('[gmail/callback]', 'email_accounts upsert error', { error: emailAccountError.message })
    return NextResponse.redirect(`${base}/settings?provider=gmail&status=error&reason=save_failed`)
  }

  // Re-link this mailbox's existing conversations to the same store (cascade on link).
  if (workspaceId && upsertedAccount) {
    await syncConversationsToAccountStore(workspaceId, upsertedAccount.id, storeId || null)
  }

  const gmailPushTopic = process.env.GMAIL_PUSH_TOPIC
  if (gmailPushTopic && tokens.access_token) {
    try {
      const watchRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topicName: gmailPushTopic,
          labelIds: ['INBOX'],
        }),
      })

      if (watchRes.ok) {
        const watchExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        await supabaseAdmin
          .from('email_accounts')
          .update({ watch_expiry: watchExpiry })
          .eq('workspace_id', workspaceId)
          .eq('provider', 'gmail')
          .eq('email_address', emailAddress)
      } else {
        logger.error('[gmail/callback]', 'Watch registration failed', { status: watchRes.status })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('[gmail/callback]', 'Watch registration error', { error: msg })
    }
  }

  return NextResponse.redirect(`${base}/settings?provider=gmail&status=connected`)
}
