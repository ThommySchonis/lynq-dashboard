import { supabaseAdmin } from './supabaseAdmin'
import { logger } from './logger'

interface IntegrationRow {
  shopify_domain: string
  shopify_access_token: string | null
  shopify_client_id: string | null
  shopify_client_secret: string | null
  shopify_refresh_token: string | null
  shopify_token_expires_at: string | null
  shopify_refresh_token_expires_at: string | null
}

interface RefreshResult {
  access_token: string
  refresh_token: string
  expires_in: number
  refresh_token_expires_in: number
  scope?: string
}

/**
 * Refresh a Shopify OAuth token using the refresh_token grant.
 * Returns the new token set on success, null on failure.
 */
async function refreshShopifyToken(
  domain: string,
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<RefreshResult | null> {
  try {
    const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      logger.error('[store-credentials]', 'Shopify token refresh failed', {
        status: res.status,
        body: body.slice(0, 200),
        domain,
      })
      return null
    }

    return (await res.json()) as RefreshResult
  } catch (err) {
    logger.error('[store-credentials]', 'Shopify token refresh error', {
      error: err instanceof Error ? err.message : String(err),
      domain,
    })
    return null
  }
}

const REFRESH_BUFFER_MS = 5 * 60 * 1000 // 5 minutes

const INTEGRATION_SELECT =
  'shopify_domain, shopify_access_token, shopify_client_id, shopify_client_secret, shopify_refresh_token, shopify_token_expires_at, shopify_refresh_token_expires_at'

type Credentials = { domain: string; accessToken: string }

async function fetchIntegrationRow(storeId: string, workspaceId: string): Promise<IntegrationRow | null> {
  const { data, error } = await supabaseAdmin
    .from('integrations')
    .select(INTEGRATION_SELECT)
    .eq('store_id', storeId)
    .eq('workspace_id', workspaceId)
    .single()

  if (error || !data) return null
  return data as unknown as IntegrationRow
}

/**
 * Return usable credentials from a row when its access token is immediately
 * usable — i.e. a manual/non-expiring token, or an OAuth token that is still
 * outside the refresh buffer. Returns null when the token is missing or is
 * within the refresh window (caller must refresh).
 */
function readyCredentials(row: IntegrationRow): Credentials | null {
  if (!row.shopify_access_token) return null
  // Non-expiring / manual token — usable as-is.
  if (!row.shopify_token_expires_at) {
    return { domain: row.shopify_domain, accessToken: row.shopify_access_token }
  }
  // Still fresh — usable as-is.
  const expiresAt = new Date(row.shopify_token_expires_at).getTime()
  if (expiresAt > Date.now() + REFRESH_BUFFER_MS) {
    return { domain: row.shopify_domain, accessToken: row.shopify_access_token }
  }
  return null
}

/**
 * Mark the integration as needing reconnection. Surfacing this on the row lets
 * the stores UI show its "Reconnect required" badge / "Needs reauth" tab (which
 * key on status === 'reauth_required') instead of a store that looks connected
 * but silently 422s every Shopify call. Always returns null for convenience.
 */
async function markReconnectRequired(storeId: string, workspaceId: string): Promise<null> {
  const { error } = await supabaseAdmin
    .from('integrations')
    .update({ status: 'reauth_required' })
    .eq('store_id', storeId)
    .eq('workspace_id', workspaceId)
  if (error) {
    logger.error('[store-credentials]', 'Failed to mark integration status=reauth_required', {
      storeId,
      error: error.message,
    })
  }
  return null
}

/**
 * Get Shopify credentials for a specific store.
 * Automatically refreshes expiring OAuth tokens when they are within 5 minutes of expiry.
 * Returns null when the store has no integration, no access token, or refresh has failed.
 *
 * Shopify refresh tokens are single-use and rotate on every refresh. This app has
 * more than one refresher (this on-demand path plus the shopify-sync cron), so a
 * refresh here can lose a race and 401 because a concurrent refresher already
 * rotated the token. On failure we therefore re-read the row before giving up:
 * the winner may have just written a fresh token we can use.
 */
export async function getStoreCredentials(
  storeId: string,
  workspaceId: string
): Promise<Credentials | null> {
  const row = await fetchIntegrationRow(storeId, workspaceId)
  if (!row) return null

  const ready = readyCredentials(row)
  if (ready) return ready

  // Access token is missing or within the refresh window. It must be refreshed.
  if (!row.shopify_access_token) return null

  // Refresh token missing or expired — the store must reconnect via OAuth.
  if (!row.shopify_refresh_token) return markReconnectRequired(storeId, workspaceId)
  if (
    row.shopify_refresh_token_expires_at &&
    new Date(row.shopify_refresh_token_expires_at).getTime() < Date.now()
  ) {
    return markReconnectRequired(storeId, workspaceId)
  }

  // Resolve client credentials: per-row with env var fallback.
  const clientId = row.shopify_client_id || process.env.SHOPIFY_CLIENT_ID || ''
  const clientSecret = row.shopify_client_secret || process.env.SHOPIFY_CLIENT_SECRET || ''
  if (!clientId || !clientSecret) {
    // A configuration problem, not a reconnect problem — don't flag the store.
    logger.error('[store-credentials]', 'Missing client credentials for token refresh', { storeId })
    return null
  }

  const refreshed = await refreshShopifyToken(row.shopify_domain, clientId, clientSecret, row.shopify_refresh_token)
  if (!refreshed) {
    // Our refresh failed. A concurrent refresher may have already rotated the
    // single-use token and written a fresh one — re-read before giving up.
    const fresh = await fetchIntegrationRow(storeId, workspaceId)
    const freshCreds = fresh && readyCredentials(fresh)
    if (freshCreds) return freshCreds
    return markReconnectRequired(storeId, workspaceId)
  }

  const now = new Date()
  const newExpiresAt = new Date(now.getTime() + refreshed.expires_in * 1000).toISOString()
  const newRefreshExpiresAt = new Date(now.getTime() + refreshed.refresh_token_expires_in * 1000).toISOString()

  // Persist the rotated tokens. If the write fails the refreshed token is still
  // valid for THIS request, but the new (rotated) refresh token would be lost —
  // log loudly so the orphaned-token case is visible rather than silent.
  const { error: updateError } = await supabaseAdmin
    .from('integrations')
    .update({
      shopify_access_token: refreshed.access_token,
      shopify_refresh_token: refreshed.refresh_token,
      shopify_token_expires_at: newExpiresAt,
      shopify_refresh_token_expires_at: newRefreshExpiresAt,
      status: 'connected',
    })
    .eq('store_id', storeId)
    .eq('workspace_id', workspaceId)
  if (updateError) {
    logger.error('[store-credentials]', 'Failed to persist refreshed Shopify token', {
      storeId,
      error: updateError.message,
    })
  }

  return { domain: row.shopify_domain, accessToken: refreshed.access_token }
}
