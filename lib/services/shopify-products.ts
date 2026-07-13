import { shopifyGraphQL } from './shopify-graphql'
import type {
  ShopifyCredentials,
  GqlProductsResponse,
  ProductSearchResult,
} from './shopify-types'

// GraphQL node shapes for the products browse/search connection.

// Unwrapped `data` shape for the products query. `products` stays optional
// here (even though it's required within GqlProductsResponse['data']) to
// preserve the original defensive `?.`/`??` fallbacks below.
type ProductsQueryData = { products?: NonNullable<GqlProductsResponse['data']>['products'] }

const PRODUCTS_QUERY = `
  query browseProducts($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query, sortKey: TITLE) {
      edges {
        cursor
        node {
          id
          title
          featuredImage { url }
          variants(first: 100) {
            edges {
              node { id title price sku availableForSale }
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`

// gid://shopify/ProductVariant/456 -> "456". Draft-order creation needs the
// numeric legacy id (createDraftOrder does Number(variantId)).
function legacyId(gid: string): string {
  return gid.split('/').pop() ?? gid
}

/**
 * Browse or search Shopify products via the GraphQL Admin API with cursor
 * pagination. Empty `query` browses the whole catalog; a non-empty `query`
 * filters by title. Returns one page plus the cursor for the next page.
 */
export async function searchProducts(
  credentials: ShopifyCredentials,
  query: string,
  limit = 20,
  cursor?: string | null,
): Promise<{ products: ProductSearchResult[]; nextCursor: string | null; hasNextPage: boolean }> {
  const trimmed = query.trim()
  const variables = {
    first: Math.min(Math.max(limit, 1), 50),
    after: cursor ?? null,
    query: trimmed ? `title:*${trimmed}*` : null,
  }

  const data = await shopifyGraphQL<ProductsQueryData>(credentials, PRODUCTS_QUERY, variables)

  const conn = data.products
  const products: ProductSearchResult[] = (conn?.edges ?? []).map(({ node }) => ({
    productId: legacyId(node.id),
    productTitle: node.title,
    image: node.featuredImage?.url,
    variants: node.variants.edges.map(({ node: v }) => ({
      variantId: legacyId(v.id),
      title: v.title || 'Default',
      price: v.price ?? '0',
      sku: v.sku || undefined,
      available: v.availableForSale,
    })),
  }))

  return {
    products,
    nextCursor: conn?.pageInfo.endCursor ?? null,
    hasNextPage: conn?.pageInfo.hasNextPage ?? false,
  }
}
