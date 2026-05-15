import { supabaseAdmin } from './supabaseAdmin'
import { getShopifyCredentialsByWorkspace } from './shopifyCredentials'

/**
 * Resolve Shopify credentials for a specific store.
 * Falls back to workspace-level integrations if store not found.
 */
export async function getStoreCredentials(
  storeId: string,
  workspaceId: string
): Promise<{ domain: string; accessToken: string } | null> {
  // 1. Try stores table
  const { data: store } = await supabaseAdmin
    .from('stores')
    .select('shopify_domain, shopify_access_token')
    .eq('id', storeId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (store?.shopify_access_token) {
    return { domain: store.shopify_domain, accessToken: store.shopify_access_token }
  }

  // 2. Fallback to integrations (removed after full migration)
  return getShopifyCredentialsByWorkspace(workspaceId)
}

/**
 * Resolve credentials: if store_id is provided use getStoreCredentials,
 * otherwise fall back to workspace-level credentials.
 */
export async function resolveCredentials(
  storeId: string | null,
  workspaceId: string
): Promise<{ domain: string; accessToken: string } | null> {
  if (storeId) {
    return getStoreCredentials(storeId, workspaceId)
  }
  return getShopifyCredentialsByWorkspace(workspaceId)
}
