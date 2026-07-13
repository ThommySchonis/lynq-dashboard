import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
import { shopifyGraphQL, SHOPIFY_GRAPHQL_VERSION } from '@/lib/services/shopify-graphql'
import { ShopifyApiError } from '@/lib/services/shopify-core'

const creds = { domain: 'acme.myshopify.com', accessToken: 'tok' }

function mockFetch(res: { ok: boolean; status?: number; json: unknown }) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: res.ok, status: res.status ?? (res.ok ? 200 : 500),
    // resilientFetch reads the body via text() (not json()) — mirror the
    // payload there so these mocks exercise the real parsing path.
    json: async () => res.json, text: async () => JSON.stringify(res.json),
  })))
}
beforeEach(() => vi.unstubAllGlobals())

describe('shopifyGraphQL', () => {
  it('posts the query to the graphql endpoint with the token header and returns data', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, status: 200, json: async () => ({ data: { shop: { name: 'Acme' } } }), text: async () => JSON.stringify({ data: { shop: { name: 'Acme' } } }) }))
    vi.stubGlobal('fetch', fetchMock)
    const out = await shopifyGraphQL<{ shop: { name: string } }>(creds, 'query { shop { name } }')
    expect(out).toEqual({ shop: { name: 'Acme' } })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`https://acme.myshopify.com/admin/api/${SHOPIFY_GRAPHQL_VERSION}/graphql.json`)
    expect((init as RequestInit).method).toBe('POST')
    expect((init as { headers: Record<string, string> }).headers['X-Shopify-Access-Token']).toBe('tok')
  })
  it('throws ShopifyApiError on HTTP failure', async () => {
    mockFetch({ ok: false, status: 401, json: {} })
    await expect(shopifyGraphQL(creds, 'query {}')).rejects.toBeInstanceOf(ShopifyApiError)
  })
  it('throws ShopifyApiError when the response has a GraphQL errors array', async () => {
    mockFetch({ ok: true, json: { errors: [{ message: 'Field x doesn\'t exist' }] } })
    await expect(shopifyGraphQL(creds, 'query {}')).rejects.toBeInstanceOf(ShopifyApiError)
  })
})
