import { assertEquals } from '@std/assert'
import { mapShopifyStatusToLocal, normalizeStatus } from '../lib/services/shopify-billing.ts'

Deno.test('mapShopifyStatusToLocal: Shopify ACTIVE → local active', () => {
  assertEquals(mapShopifyStatusToLocal('ACTIVE'), 'active')
})

Deno.test('mapShopifyStatusToLocal: ACCEPTED is treated as active', () => {
  assertEquals(mapShopifyStatusToLocal('ACCEPTED'), 'active')
})

Deno.test('mapShopifyStatusToLocal: PENDING → pending_shopify_subscription', () => {
  assertEquals(mapShopifyStatusToLocal('PENDING'), 'pending_shopify_subscription')
})

Deno.test('mapShopifyStatusToLocal: CANCELLED → canceled', () => {
  assertEquals(mapShopifyStatusToLocal('CANCELLED'), 'canceled')
})

Deno.test('mapShopifyStatusToLocal: EXPIRED / DECLINED / FROZEN → past_due', () => {
  assertEquals(mapShopifyStatusToLocal('EXPIRED'), 'past_due')
  assertEquals(mapShopifyStatusToLocal('DECLINED'), 'past_due')
  assertEquals(mapShopifyStatusToLocal('FROZEN'), 'past_due')
})

Deno.test('normalizeStatus: unknown values return null', () => {
  assertEquals(normalizeStatus('something_else'), null)
  assertEquals(normalizeStatus(null), null)
})

Deno.test('normalizeStatus: ACCEPTED is normalized to active', () => {
  assertEquals(normalizeStatus('ACCEPTED'), 'active')
})
