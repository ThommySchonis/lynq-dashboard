import { describe, it, expect } from 'vitest'
import { validateCsrfOrigin } from './csrf'

function req(method: string, headers: Record<string, string>) {
  return {
    method,
    url: 'https://app.lynqflow.io/api/auth/shopify',
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  }
}

describe('validateCsrfOrigin', () => {
  it('allows mutating requests from the production custom domain', () => {
    const result = validateCsrfOrigin(
      req('POST', { origin: 'https://app.lynqflow.io' }),
    )
    expect(result.valid).toBe(true)
  })

  it('allows the Vercel default domain', () => {
    const result = validateCsrfOrigin(
      req('POST', { origin: 'https://lynq-dashboard.vercel.app' }),
    )
    expect(result.valid).toBe(true)
  })

  it('allows Vercel preview deployments', () => {
    const result = validateCsrfOrigin(
      req('POST', { origin: 'https://lynq-dashboard-abc123.vercel.app' }),
    )
    expect(result.valid).toBe(true)
  })

  it('falls back to Referer when Origin is absent', () => {
    const result = validateCsrfOrigin(
      req('POST', { referer: 'https://app.lynqflow.io/dashboard' }),
    )
    expect(result.valid).toBe(true)
  })

  it('rejects a foreign origin', () => {
    const result = validateCsrfOrigin(
      req('POST', { origin: 'https://evil.example.com' }),
    )
    expect(result.valid).toBe(false)
  })

  it('skips non-mutating methods', () => {
    const result = validateCsrfOrigin(req('GET', {}))
    expect(result.valid).toBe(true)
  })

  it('exempts webhook paths', () => {
    const result = validateCsrfOrigin({
      method: 'POST',
      url: 'https://app.lynqflow.io/api/webhooks/shopify',
      headers: { get: () => null },
    })
    expect(result.valid).toBe(true)
  })
})
