import { getAdminClient } from './supabase.ts'
import { logger } from './logger.ts'

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

const REFRESH_BUFFER_MS = 5 * 60 * 1000

export async function getStoreCredentials(
  storeId: string,
  workspaceId: string
): Promise<{ domain: string; accessToken: string } | null> {
  const sb = getAdminClient()
  const { data, error } = await sb
    .from('integrations')
    .select(
      'shopify_domain, shopify_access_token, shopify_client_id, shopify_client_secret, shopify_refresh_token, shopify_token_expires_at, shopify_refresh_token_expires_at'
    )
    .eq('store_id', storeId)
    .eq('workspace_id', workspaceId)
    .single()

  if (error || !data) return null

  const row = data as unknown as IntegrationRow
  if (!row.shopify_access_token) return null

  if (!row.shopify_token_expires_at) {
    return { domain: row.shopify_domain, accessToken: row.shopify_access_token }
  }

  const expiresAt = new Date(row.shopify_token_expires_at).getTime()
  if (expiresAt > Date.now() + REFRESH_BUFFER_MS) {
    return { domain: row.shopify_domain, accessToken: row.shopify_access_token }
  }

  if (!row.shopify_refresh_token) return null
  if (row.shopify_refresh_token_expires_at && new Date(row.shopify_refresh_token_expires_at).getTime() < Date.now()) {
    return null
  }

  const clientId = row.shopify_client_id || Deno.env.get('SHOPIFY_CLIENT_ID') || ''
  const clientSecret = row.shopify_client_secret || Deno.env.get('SHOPIFY_CLIENT_SECRET') || ''
  if (!clientId || !clientSecret) {
    logger.error('[store-credentials]', 'Missing client credentials for token refresh', { storeId })
    return null
  }

  const refreshed = await refreshShopifyToken(row.shopify_domain, clientId, clientSecret, row.shopify_refresh_token)
  if (!refreshed) return null

  const now = new Date()
  const newExpiresAt = new Date(now.getTime() + refreshed.expires_in * 1000).toISOString()
  const newRefreshExpiresAt = new Date(now.getTime() + refreshed.refresh_token_expires_in * 1000).toISOString()

  await sb
    .from('integrations')
    .update({
      shopify_access_token: refreshed.access_token,
      shopify_refresh_token: refreshed.refresh_token,
      shopify_token_expires_at: newExpiresAt,
      shopify_refresh_token_expires_at: newRefreshExpiresAt,
    })
    .eq('store_id', storeId)
    .eq('workspace_id', workspaceId)

  return { domain: row.shopify_domain, accessToken: refreshed.access_token }
}
