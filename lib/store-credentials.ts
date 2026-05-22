import { supabaseAdmin } from './supabaseAdmin'

/**
 * Get Shopify credentials for a specific store.
 * Reads from integrations table where store_id matches.
 * No fallback — store_id is required.
 */
export async function getStoreCredentials(
  storeId: string,
  workspaceId: string
): Promise<{ domain: string; accessToken: string }> {
  const { data, error } = await supabaseAdmin
    .from('integrations')
    .select('shopify_domain, shopify_access_token')
    .eq('store_id', storeId)
    .eq('workspace_id', workspaceId)
    .single()

  if (error || !data) {
    throw new Error('Store not connected or credentials missing')
  }

  const row = data as unknown as { shopify_domain: string; shopify_access_token: string | null }
  if (!row.shopify_access_token) {
    throw new Error('Store not connected or credentials missing')
  }

  return { domain: row.shopify_domain, accessToken: row.shopify_access_token }
}
