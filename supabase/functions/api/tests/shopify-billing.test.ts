import { assertEquals } from '@std/assert'
import {
  mapShopifyStatusToLocal,
  normalizeStatus,
  resolveLocalSubscriptionState,
  deriveUsagePeriod,
} from '../lib/services/shopify-billing.ts'

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

Deno.test('resolveLocalSubscriptionState: active + mapped plan → active, not unmapped', () => {
  assertEquals(resolveLocalSubscriptionState('ACTIVE', true), { status: 'active', planUnmapped: false })
})

Deno.test('resolveLocalSubscriptionState: active + UNmapped plan → hard block', () => {
  assertEquals(
    resolveLocalSubscriptionState('ACTIVE', false),
    { status: 'pending_shopify_subscription', planUnmapped: true },
  )
})

Deno.test('resolveLocalSubscriptionState: pending is never unmapped', () => {
  assertEquals(
    resolveLocalSubscriptionState('PENDING', false),
    { status: 'pending_shopify_subscription', planUnmapped: false },
  )
})

Deno.test('deriveUsagePeriod: period_end is currentPeriodEnd, start is 30 days earlier', () => {
  const r = deriveUsagePeriod('2026-07-31T00:00:00.000Z')
  assertEquals(r.period_end, '2026-07-31T00:00:00.000Z')
  assertEquals(r.period_start, '2026-07-01T00:00:00.000Z')
})
