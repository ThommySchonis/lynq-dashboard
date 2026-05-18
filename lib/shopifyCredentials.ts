import { supabaseAdmin } from './supabaseAdmin'

interface IntegrationCredentialRow {
  shopify_domain: string
  shopify_access_token: string | null
}

interface ClientCredentialRow {
  shopify_domain: string
  shopify_api_key: string | null
}

// Workspace-scoped credentials lookup. Returns OAuth token from integrations
// row tied to the workspace, or null. Used by routes that have already
// resolved getAuthContext().
export async function getShopifyCredentialsByWorkspace(workspaceId: string): Promise<{ domain: string; accessToken: string } | null> {
  if (!workspaceId) return null

  const { data: integRow } = await supabaseAdmin
    .from('integrations')
    .select('shopify_domain, shopify_access_token')
    .eq('workspace_id', workspaceId)
    .maybeSingle<IntegrationCredentialRow>()

  if (integRow?.shopify_access_token) {
    return {
      domain:      integRow.shopify_domain,
      accessToken: integRow.shopify_access_token,
    }
  }

  return null
}

// Legacy single-tenant lookup. Tries integrations table (by user_id) first,
// falls back to clients table (manual API key by email). Still in use by
// routes that haven't been migrated yet — do not call from new code.
export async function getShopifyCredentials(userId: string, userEmail: string): Promise<{ domain: string; accessToken: string } | null> {
  // 1. Try OAuth token from integrations table
  const { data: integRow } = await supabaseAdmin
    .from('integrations')
    .select('shopify_domain, shopify_access_token')
    .eq('client_id', userId)
    .maybeSingle<IntegrationCredentialRow>()

  if (integRow?.shopify_access_token) {
    return {
      domain: integRow.shopify_domain,
      accessToken: integRow.shopify_access_token,
    }
  }

  // 2. Fall back to manually entered API key in clients table
  const { data: clientRow } = await supabaseAdmin
    .from('clients')
    .select('shopify_domain, shopify_api_key')
    .eq('email', userEmail)
    .maybeSingle<ClientCredentialRow>()

  if (clientRow?.shopify_api_key) {
    return {
      domain: clientRow.shopify_domain,
      accessToken: clientRow.shopify_api_key,
    }
  }

  return null
}
