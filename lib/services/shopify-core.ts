import { resilientFetch } from '@/lib/resilient-fetch'
import type {
  ShopifyCredentials,
  PaginatedResult,
} from './shopify-types'

// ── Error class ──────────────────────────────────────────────────────────────
export class ShopifyApiError extends Error {
  statusCode: number
  endpoint: string

  constructor(message: string, statusCode: number, endpoint: string) {
    super(message)
    this.name = 'ShopifyApiError'
    this.statusCode = statusCode
    this.endpoint = endpoint
  }
}

// ── Internal Shopify REST helper ─────────────────────────────────────────────
export const SHOPIFY_API_VERSION = '2025-04'

/**
 * Paginated fetch for Shopify REST endpoints that need Link-header pagination.
 * Uses retry logic consistent with resilientFetch (429 + Retry-After handling).
 */
export async function shopifyPaginatedFetch<T>(
  credentials: ShopifyCredentials,
  url: string,
): Promise<PaginatedResult<T>> {
  const MAX_RETRIES = 2
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': credentials.accessToken },
      signal: AbortSignal.timeout(10_000),
    })

    if (res.status === 429) {
      const wait = parseInt(res.headers.get('Retry-After') || '2', 10) * 1000
      await new Promise<void>((r) => setTimeout(r, wait))
      continue
    }

    if (!res.ok) {
      throw new ShopifyApiError(`Shopify paginated fetch failed`, res.status, url)
    }

    const data = (await res.json()) as T
    const link: string | null = res.headers.get('link')
    const next: RegExpMatchArray | null | undefined = link?.match(/<([^>]+)>;\s*rel="next"/)
    const nextUrl: string | null = next?.[1] ?? null
    const result: PaginatedResult<T> = { data, nextUrl }
    return result
  }

  throw new ShopifyApiError('Shopify rate limit exceeded after retries', 429, url)
}

export async function shopifyFetchJSON<T = Record<string, unknown>>(credentials: ShopifyCredentials, path: string, options: RequestInit = {}): Promise<T> {
  const url = `https://${credentials.domain}/admin/api/${SHOPIFY_API_VERSION}${path}`
  const res = await resilientFetch<T>('shopify', url, {
    ...options,
    headers: {
      'X-Shopify-Access-Token': credentials.accessToken,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined ?? {}),
    },
  })
  if (!res.ok) {
    throw new ShopifyApiError(
      res.error || `Shopify API error on ${path}`,
      res.status,
      path
    )
  }
  return res.data
}
