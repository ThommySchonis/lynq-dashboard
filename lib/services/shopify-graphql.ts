import { ShopifyApiError, SHOPIFY_API_VERSION } from '@/lib/services/shopify-core'
import { resilientFetch } from '@/lib/resilient-fetch'
import { logger } from '@/lib/logger'

// Single GraphQL Admin API version for the whole app. Kept equal to the REST
// version (SHOPIFY_API_VERSION) so this refactor does not change behavior of
// the existing, already-working GraphQL calls it replaces. A deliberate
// version bump is a separate, later change.
export const SHOPIFY_GRAPHQL_VERSION = SHOPIFY_API_VERSION

interface GraphQLResponse<T> { data?: T; errors?: Array<{ message: string }> }

/**
 * Shared Shopify Admin GraphQL POST helper. Throws ShopifyApiError on HTTP
 * failure or a non-empty GraphQL `errors` array; otherwise returns the
 * unwrapped `data` field typed as T.
 */
export async function shopifyGraphQL<T = Record<string, unknown>>(
  credentials: { domain: string; accessToken: string },
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const url = `https://${credentials.domain}/admin/api/${SHOPIFY_GRAPHQL_VERSION}/graphql.json`
  const res = await resilientFetch<GraphQLResponse<T>>('shopify', url, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': credentials.accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables: variables ?? {} }),
  })
  if (!res.ok) {
    throw new ShopifyApiError(res.error || 'Shopify GraphQL request failed', res.status, 'graphql')
  }
  if (!res.data) {
    throw new ShopifyApiError('Shopify GraphQL returned an empty response', res.status, 'graphql')
  }
  if (res.data.errors?.length) {
    const msg = res.data.errors.map((e) => e.message).join('; ')
    logger.error('[shopify/graphql]', 'GraphQL errors', { msg })
    throw new ShopifyApiError(`Shopify GraphQL error: ${msg}`, 200, 'graphql')
  }
  if (!res.data.data) {
    throw new ShopifyApiError('Shopify GraphQL returned no data', 200, 'graphql')
  }
  return res.data.data
}
