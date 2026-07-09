// Shared Shopify token refresh helper for Edge Functions (Deno runtime).
// Mirrors the refresh logic in lib/store-credentials.ts — keep both in sync.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface RefreshResult {
  access_token: string
  refresh_token: string
  expires_in: number
  refresh_token_expires_in: number
}

interface IntegrationToRefresh {
  workspace_id: string
  store_id: string
  shopify_domain: string
  shopify_client_id: string | null
  shopify_client_secret: string | null
  shopify_refresh_token: string
}

/**
 * Refresh expiring Shopify tokens that are within `bufferMinutes` of expiry.
 * Updates the DB rows in-place. Returns the count of successfully refreshed tokens.
 */
export async function refreshExpiringTokens(bufferMinutes = 10): Promise<number> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const bufferTs = new Date(Date.now() + bufferMinutes * 60 * 1000).toISOString()

  // Fetch integrations with expiring access tokens that have a refresh token.
  // Note: shopify_refresh_token_expires_at may be null (treat as "not expired" — attempt refresh).
  const { data: expiring } = await supabase
    .from('integrations')
    .select('workspace_id, store_id, shopify_domain, shopify_client_id, shopify_client_secret, shopify_refresh_token, shopify_refresh_token_expires_at')
    .not('shopify_token_expires_at', 'is', null)
    .lt('shopify_token_expires_at', bufferTs)
    .not('shopify_refresh_token', 'is', null)
    .or(`shopify_refresh_token_expires_at.is.null,shopify_refresh_token_expires_at.gt.${new Date().toISOString()}`)

  if (!expiring || expiring.length === 0) return 0

  const clientIdFallback = Deno.env.get('SHOPIFY_CLIENT_ID') ?? ''
  const clientSecretFallback = Deno.env.get('SHOPIFY_CLIENT_SECRET') ?? ''

  let refreshed = 0

  for (const int of expiring as IntegrationToRefresh[]) {
    const clientId = int.shopify_client_id || clientIdFallback
    const clientSecret = int.shopify_client_secret || clientSecretFallback
    if (!clientId || !clientSecret || !int.shopify_refresh_token) continue

    try {
      const res = await fetch(`https://${int.shopify_domain}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: int.shopify_refresh_token,
        }),
        signal: AbortSignal.timeout(10_000),
      })

      if (!res.ok) {
        console.error(`[shopify-token] refresh failed for store ${int.store_id}: HTTP ${res.status}`)

        // If the refresh token is rejected (401/403), the store may need to
        // reconnect — OR a concurrent refresher (the on-demand getStoreCredentials
        // path) already rotated this single-use token and won the race. Re-read
        // before flagging: only mark error when the token is genuinely still expired.
        if (res.status === 401 || res.status === 403) {
          const { data: current } = await supabase
            .from('integrations')
            .select('shopify_token_expires_at')
            .eq('store_id', int.store_id)
            .eq('workspace_id', int.workspace_id)
            .single()
          const exp = current?.shopify_token_expires_at
            ? new Date(current.shopify_token_expires_at).getTime()
            : 0
          if (exp <= Date.now()) {
            // 'reauth_required' is the status the stores UI renders as
            // "Reconnect required" — align with it so cron failures are visible.
            await supabase
              .from('integrations')
              .update({ status: 'reauth_required' })
              .eq('store_id', int.store_id)
              .eq('workspace_id', int.workspace_id)
          }
        }
        continue
      }

      const data = (await res.json()) as RefreshResult
      const now = new Date()

      await supabase
        .from('integrations')
        .update({
          shopify_access_token: data.access_token,
          shopify_refresh_token: data.refresh_token,
          shopify_token_expires_at: new Date(now.getTime() + data.expires_in * 1000).toISOString(),
          shopify_refresh_token_expires_at: new Date(now.getTime() + data.refresh_token_expires_in * 1000).toISOString(),
          status: 'connected',
        })
        .eq('store_id', int.store_id)
        .eq('workspace_id', int.workspace_id)

      refreshed++
      console.log(`[shopify-token] refreshed token for store ${int.store_id}`)
    } catch (err) {
      console.error(`[shopify-token] error refreshing store ${int.store_id}:`, err)
    }
  }

  return refreshed
}
