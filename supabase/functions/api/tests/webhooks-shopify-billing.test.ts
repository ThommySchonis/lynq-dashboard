import { assertEquals } from '@std/assert'
import { verifyHmac } from '../routes/webhooks-shopify-billing.ts'

async function computeHmac(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body)))
  return btoa(String.fromCharCode(...sig))
}

Deno.test('verifyHmac accepts a correctly-signed body', async () => {
  const body = '{"app_subscription":{"id":"gid://shopify/AppSubscription/1"}}'
  const secret = 'test-secret'
  const sig = await computeHmac(body, secret)
  assertEquals(await verifyHmac(body, sig, secret), true)
})

Deno.test('verifyHmac rejects a tampered body', async () => {
  const body = '{"app_subscription":{"id":"gid://shopify/AppSubscription/1","status":"ACTIVE"}}'
  const tampered = body.replace('"ACTIVE"', '"PENDING"')
  const secret = 'test-secret'
  const sig = await computeHmac(body, secret)
  assertEquals(await verifyHmac(tampered, sig, secret), false)
})

Deno.test('verifyHmac rejects a missing signature', async () => {
  assertEquals(await verifyHmac('{}', null, 'test-secret'), false)
})

Deno.test('verifyHmac rejects a wrong secret', async () => {
  const body = '{"x":1}'
  const sig = await computeHmac(body, 'one-secret')
  assertEquals(await verifyHmac(body, sig, 'other-secret'), false)
})
