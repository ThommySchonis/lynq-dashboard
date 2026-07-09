import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── supabaseAdmin mock ────────────────────────────────────────────────────────
// A chainable, awaitable query-builder stub. Every terminal read (`.single()`)
// and every awaited write resolves to the next response queued in `responses`.
// `updates` captures the payload passed to `.update(...)` so tests can assert
// what was written (e.g. status: 'reauth_required').
const responses: Array<{ data: unknown; error: unknown }> = []
const updates: Array<Record<string, unknown>> = []

function makeBuilder() {
  const b: Record<string, unknown> = {}
  const chain = () => b
  b.select = vi.fn(chain)
  b.update = vi.fn((vals: Record<string, unknown>) => {
    updates.push(vals)
    return b
  })
  b.eq = vi.fn(chain)
  b.single = vi.fn(() => Promise.resolve(responses.shift() ?? { data: null, error: null }))
  // Awaiting the builder itself (the update path has no `.single()`) resolves the
  // next queued response.
  b.then = (resolve: (v: unknown) => unknown) => resolve(responses.shift() ?? { data: null, error: null })
  return b
}

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: { from: vi.fn(() => makeBuilder()) },
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

import { getStoreCredentials } from '@/lib/store-credentials'

const STORE = 'store-1'
const WS = 'ws-1'
const past = () => new Date(Date.now() - 60_000).toISOString()
const future = () => new Date(Date.now() + 24 * 3600_000).toISOString()

function expiredRow(overrides: Record<string, unknown> = {}) {
  return {
    shopify_domain: 'shop.myshopify.com',
    shopify_access_token: 'stale-token',
    shopify_client_id: 'cid',
    shopify_client_secret: 'csec',
    shopify_refresh_token: 'old-refresh',
    shopify_token_expires_at: past(),
    shopify_refresh_token_expires_at: future(),
    ...overrides,
  }
}

function mockFetch(res: { ok: boolean; status?: number; json?: unknown }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: res.ok,
      status: res.status ?? (res.ok ? 200 : 401),
      json: async () => res.json,
      text: async () => 'error body',
    })),
  )
}

beforeEach(() => {
  responses.length = 0
  updates.length = 0
  vi.unstubAllGlobals()
})

describe('getStoreCredentials refresh failure handling', () => {
  it('returns the fresh token a concurrent refresher wrote when its own refresh 401s', async () => {
    // Read #1: expired access token, valid refresh token → triggers refresh.
    responses.push({ data: expiredRow(), error: null })
    // Shopify rejects the refresh (the single-use token was already rotated by a
    // concurrent refresher — cron or another request).
    mockFetch({ ok: false, status: 401 })
    // Re-read: the concurrent refresher has already written a fresh token.
    responses.push({
      data: expiredRow({ shopify_access_token: 'fresh-token', shopify_token_expires_at: future() }),
      error: null,
    })

    const creds = await getStoreCredentials(STORE, WS)

    expect(creds).toEqual({ domain: 'shop.myshopify.com', accessToken: 'fresh-token' })
  })

  it('marks the integration reauth_required when refresh fails and no fresh token exists', async () => {
    responses.push({ data: expiredRow(), error: null })
    mockFetch({ ok: false, status: 401 })
    // Re-read: still expired — nobody else refreshed, the token is truly dead.
    responses.push({ data: expiredRow(), error: null })
    // status update write
    responses.push({ data: null, error: null })

    const creds = await getStoreCredentials(STORE, WS)

    expect(creds).toBeNull()
    expect(updates).toContainEqual(expect.objectContaining({ status: 'reauth_required' }))
  })

  it('marks reauth_required when the token is expired and there is no refresh token', async () => {
    responses.push({ data: expiredRow({ shopify_refresh_token: null }), error: null })
    responses.push({ data: null, error: null }) // status update write

    const creds = await getStoreCredentials(STORE, WS)

    expect(creds).toBeNull()
    expect(updates).toContainEqual(expect.objectContaining({ status: 'reauth_required' }))
  })

  it('still returns a manual (non-expiring) token untouched', async () => {
    responses.push({
      data: expiredRow({ shopify_token_expires_at: null, shopify_access_token: 'manual-token' }),
      error: null,
    })

    const creds = await getStoreCredentials(STORE, WS)

    expect(creds).toEqual({ domain: 'shop.myshopify.com', accessToken: 'manual-token' })
    expect(updates).toHaveLength(0)
  })
})
