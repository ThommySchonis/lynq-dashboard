import { assertEquals, assertThrows } from '@std/assert'
import { buildManagedPricingUrl, ShopifyAdminError } from '../lib/shopify-admin.ts'

Deno.test('buildManagedPricingUrl returns the Shopify Managed Pricing path', () => {
  Deno.env.set('SHOPIFY_APP_HANDLE', 'lynq')
  try {
    assertEquals(
      buildManagedPricingUrl('acme.myshopify.com'),
      'https://acme.myshopify.com/admin/charges/lynq/pricing_plans',
    )
  } finally {
    Deno.env.delete('SHOPIFY_APP_HANDLE')
  }
})

Deno.test('buildManagedPricingUrl throws when SHOPIFY_APP_HANDLE is missing', () => {
  Deno.env.delete('SHOPIFY_APP_HANDLE')
  assertThrows(
    () => buildManagedPricingUrl('acme.myshopify.com'),
    ShopifyAdminError,
    'SHOPIFY_APP_HANDLE',
  )
})
