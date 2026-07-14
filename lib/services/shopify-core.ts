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
