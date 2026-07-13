import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn(), auth: { admin: { getUserById: vi.fn() } } },
}))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))
vi.mock('@/lib/emails/customer-data-export', () => ({ sendCustomerDataExportEmail: vi.fn() }))

// import AFTER mocks
import { verifyHmacAgainstAppSecret } from '@/lib/services/shopify-compliance'

function sign(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64')
}

beforeEach(() => {
  vi.stubEnv('SHOPIFY_CLIENT_SECRET_PUB', '')
  vi.stubEnv('SHOPIFY_CLIENT_SECRET', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('verifyHmacAgainstAppSecret', () => {
  const secret = 'test-secret'
  const body = JSON.stringify({ shop_id: 1 })

  it('accepts a valid signature matching SHOPIFY_CLIENT_SECRET', () => {
    vi.stubEnv('SHOPIFY_CLIENT_SECRET', secret)

    const result = verifyHmacAgainstAppSecret(body, sign(body, secret))

    expect(result).toEqual({ ok: true, secretUsed: 'main' })
  })

  it('accepts a valid signature matching SHOPIFY_CLIENT_SECRET_PUB', () => {
    vi.stubEnv('SHOPIFY_CLIENT_SECRET_PUB', secret)
    vi.stubEnv('SHOPIFY_CLIENT_SECRET', 'a-different-secret')

    const result = verifyHmacAgainstAppSecret(body, sign(body, secret))

    expect(result).toEqual({ ok: true, secretUsed: 'pub' })
  })

  it('rejects a tampered/invalid signature', () => {
    vi.stubEnv('SHOPIFY_CLIENT_SECRET', secret)

    const result = verifyHmacAgainstAppSecret(body, 'bad-signature')

    expect(result).toEqual({ ok: false, secretUsed: null })
  })

  it('rejects a signature computed with the wrong secret', () => {
    vi.stubEnv('SHOPIFY_CLIENT_SECRET', secret)

    const result = verifyHmacAgainstAppSecret(body, sign(body, 'wrong-secret'))

    expect(result).toEqual({ ok: false, secretUsed: null })
  })

  it('rejects a missing HMAC header', () => {
    vi.stubEnv('SHOPIFY_CLIENT_SECRET', secret)

    const result = verifyHmacAgainstAppSecret(body, null)

    expect(result).toEqual({ ok: false, secretUsed: null })
  })

  it('rejects when no secret is configured', () => {
    const result = verifyHmacAgainstAppSecret(body, sign(body, secret))

    expect(result).toEqual({ ok: false, secretUsed: null })
  })
})
