import { assertEquals } from '@std/assert'
import { ShopifyApiError, isNonExpiringTokenError } from '../lib/services/shopify.ts'

Deno.test('matches the Shopify non-expiring token 403', () => {
  const err = new ShopifyApiError(
    '[API] Non-expiring access tokens are no longer accepted for the Admin API.',
    403,
    '/customers.json',
  )
  assertEquals(isNonExpiringTokenError(err), true)
})

Deno.test('ignores other 403 errors', () => {
  const err = new ShopifyApiError('Forbidden: scope missing', 403, '/customers.json')
  assertEquals(isNonExpiringTokenError(err), false)
})

Deno.test('ignores non-403 ShopifyApiError', () => {
  const err = new ShopifyApiError('Non-expiring access tokens are no longer accepted', 429, '/x.json')
  assertEquals(isNonExpiringTokenError(err), false)
})

Deno.test('ignores non-ShopifyApiError values', () => {
  assertEquals(isNonExpiringTokenError(new Error('Non-expiring access tokens...')), false)
  assertEquals(isNonExpiringTokenError(null), false)
})
