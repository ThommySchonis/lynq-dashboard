// ── Error class ──────────────────────────────────────────────────────────────
export class ShopifyApiError extends Error {
  statusCode: number;
  endpoint: string;

  constructor(message: string, statusCode: number, endpoint: string) {
    super(message);
    this.name = "ShopifyApiError";
    this.statusCode = statusCode;
    this.endpoint = endpoint;
  }
}

/**
 * True when an error is Shopify rejecting a non-expiring Admin API access token
 * (the deprecation that requires the store to reconnect via OAuth with expiring tokens).
 */
export function isNonExpiringTokenError(err: unknown): boolean {
  return err instanceof ShopifyApiError && err.statusCode === 403 && /non-expiring access tokens are no longer accepted/i.test(err.message);
}

// ── Internal Shopify REST helper ─────────────────────────────────────────────
export const SHOPIFY_API_VERSION = "2025-04";
