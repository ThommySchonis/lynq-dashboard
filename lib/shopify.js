import { supabaseAdmin } from './supabaseAdmin'

export async function getShopifyClient(userEmail) {
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('shopify_domain, shopify_api_key')
    .eq('email', userEmail)
    .single()

  if (!client?.shopify_domain || !client?.shopify_api_key) return null
  return client
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
