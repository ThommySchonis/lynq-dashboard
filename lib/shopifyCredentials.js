import { supabaseAdmin } from './supabaseAdmin'

// Workspace-scoped credentials lookup. Returns OAuth token from integrations
// row tied to the workspace, or null. Used by routes that have already
// resolved getAuthContext().
export async function getShopifyCredentialsByWorkspace(workspaceId) {
  if (!workspaceId) return null

  const { data: integration } = await supabaseAdmin
    .from('integrations')
    .select('shopify_domain, shopify_access_token')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (integration?.shopify_access_token) {
    return {
      domain:      integration.shopify_domain,
      accessToken: integration.shopify_access_token,
    }
  }

  return null
}

// Legacy single-tenant lookup. Tries integrations table (by user_id) first,
// falls back to clients table (manual API key by email). Still in use by
// routes that haven't been migrated yet — do not call from new code.
export async function getShopifyCredentials(userId, userEmail) {
  // 1. Try OAuth token from integrations table
  const { data: integration } = await supabaseAdmin
    .from('integrations')
    .select('shopify_domain, shopify_access_token')
    .eq('client_id', userId)
    .maybeSingle()

  if (integration?.shopify_access_token) {
    return {
      domain: integration.shopify_domain,
      accessToken: integration.shopify_access_token,
    }
  }

  // 2. Fall back to manually entered API key in clients table
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('shopify_domain, shopify_api_key')
    .eq('email', userEmail)
    .maybeSingle()

  if (client?.shopify_api_key) {
    return {
      domain: client.shopify_domain,
      accessToken: client.shopify_api_key,
    }
  }

  return null
}
