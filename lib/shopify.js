import { supabaseAdmin } from './supabaseAdmin'

// Single source of truth for Shopify credentials.
// Tries OAuth token from integrations table (client_id column) first,
// then falls back to manually entered API key in clients table (email lookup).
export async function getShopifyClient(userId, userEmail) {
  // 1. OAuth token — integrations table uses client_id
  const { data: integration } = await supabaseAdmin
    .from('integrations')
    .select('shopify_domain, shopify_access_token')
    .eq('client_id', userId)
    .maybeSingle()

  if (integration?.shopify_access_token) {
    return { shopify_domain: integration.shopify_domain, shopify_api_key: integration.shopify_access_token }
  }

  // 2. Manual API key — clients table, looked up by email
  if (userEmail) {
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('shopify_domain, shopify_api_key')
      .eq('email', userEmail)
      .maybeSingle()

    if (client?.shopify_api_key) {
      return { shopify_domain: client.shopify_domain, shopify_api_key: client.shopify_api_key }
    }
  }

  return null
}

export async function shopifyFetch(client, path, options = {}) {
  const url = `https://${client.shopify_domain}/admin/api/2025-04${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'X-Shopify-Access-Token': client.shopify_api_key,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  return res
}
