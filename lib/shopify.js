import { supabaseAdmin } from './supabaseAdmin'

export async function getShopifyClient(userId) {
  const { data } = await supabaseAdmin
    .from('integrations')
    .select('shopify_domain, shopify_access_token')
    .eq('user_id', userId)
    .single()

  if (!data?.shopify_domain || !data?.shopify_access_token) return null
  return { shopify_domain: data.shopify_domain, shopify_api_key: data.shopify_access_token }
}

export async function shopifyFetch(client, path, options = {}) {
  const url = `https://${client.shopify_domain}/admin/api/2024-01${path}`
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
