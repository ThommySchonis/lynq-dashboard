import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { encrypt } from '@/lib/encryption'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyOAuthState } from '@/lib/oauthState'
import { parseJson } from '@/lib/utils/typed-json'
import { syncAllAccounts } from '@/lib/conversationEngine'
import { validateQuery } from '@/lib/validation'
import { gmailCallbackQuery } from '@/lib/schemas/auth'

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

  const [query, queryErr] = validateQuery(request, gmailCallbackQuery)
  if (queryErr) return NextResponse.redirect(`${appUrl}/settings?provider=gmail&status=error`)

  const verifiedState = verifyOAuthState(query.state, 'gmail')

  if (!verifiedState) {
    return NextResponse.redirect(`${appUrl}/settings?provider=gmail&status=error`)
  }

  const { userId, workspaceId, storeId } = verifiedState

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  const redirectUri = `${appUrl}/api/auth/gmail/callback`

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code: query.code, client_id: clientId!, client_secret: clientSecret!, redirect_uri: redirectUri!, grant_type: 'authorization_code' }),
  })

  const tokens = await parseJson<OAuthTokenResponse>(tokenRes)
  if (!tokens.access_token) {
    return NextResponse.redirect(`${appUrl}/settings?provider=gmail&status=error&reason=token_failed`)
  }

  // Get Gmail address
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const profile = await parseJson<GoogleProfileResponse>(profileRes)
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
    store_id: storeId || null,
    status: 'active',
    is_default: isDefault,
  }

  const { error: emailAccountError } = await supabaseAdmin
    .from('email_accounts')
    .upsert(emailAccountRecord, { onConflict: 'workspace_id,provider,email_address' })

  if (emailAccountError) {
    console.error('[gmail/callback] email_accounts upsert error:', emailAccountError.message)
    return NextResponse.redirect(`${appUrl}/settings?provider=gmail&status=error&reason=save_failed`)
  }

  // Register Gmail Watch for push notifications
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
        console.error('[gmail/callback] Watch registration failed:', watchRes.status, await watchRes.text().catch(() => ''))
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[gmail/callback] Watch registration error:', msg)
    }
  }

  // Fire-and-forget: sync emails in the background so inbox is populated after redirect
  if (workspaceId) {
    syncAllAccounts(workspaceId).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[gmail/callback] background sync failed:', msg)
    })
  }

  return NextResponse.redirect(`${appUrl}/settings?provider=gmail&status=connected`)
}
