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

  if (error || !data?.shopify_access_token) {
    throw new Error('Store not connected or credentials missing')
  }

  return { domain: data.shopify_domain, accessToken: data.shopify_access_token }
}
