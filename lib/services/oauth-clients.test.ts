import { describe, it, expect } from 'vitest'
import { registerClient, getClient } from '@/lib/services/oauth-clients'
import type { OAuthClientsDb } from '@/lib/services/oauth-clients'

function fakeDb(existing: Record<string, unknown> | null) {
  const inserted: Record<string, unknown>[] = []
  const db = {
    from() {
      return {
        insert(r: Record<string, unknown>) { inserted.push(r); return { select() { return { single: async () => ({ data: r, error: null }) } } } },
        select() { return { eq() { return { maybeSingle: async () => ({ data: existing, error: null }) } } } },
      }
    },
  }
  return { db: db as unknown as OAuthClientsDb, inserted }
}

describe('registerClient', () => {
  it('generates a client_id and stores name + redirect_uris', async () => {
    const { db, inserted } = fakeDb(null)
    const c = await registerClient(db, { clientName: 'Claude', redirectUris: ['https://claude.ai/cb'] })
    expect(c.clientId.length).toBeGreaterThan(10)
    expect(c.clientName).toBe('Claude')
    expect(c.redirectUris).toEqual(['https://claude.ai/cb'])
    expect(c.tokenEndpointAuthMethod).toBe('none')
    expect(inserted[0].client_id).toBe(c.clientId)
  })
  it('rejects empty redirect_uris', async () => {
    const { db } = fakeDb(null)
    await expect(registerClient(db, { clientName: 'X', redirectUris: [] })).rejects.toThrow()
  })
  it('rejects a javascript: redirect_uri', async () => {
    const { db } = fakeDb(null)
    await expect(registerClient(db, { clientName: 'X', redirectUris: ['javascript:alert(1)'] })).rejects.toThrow('invalid redirect_uri scheme')
  })
  it('rejects more than 10 redirect_uris', async () => {
    const { db } = fakeDb(null)
    const uris = Array.from({ length: 11 }, (_, i) => `https://example.com/cb${i}`)
    await expect(registerClient(db, { clientName: 'X', redirectUris: uris })).rejects.toThrow('too many redirect_uris')
  })
})

describe('getClient', () => {
  it('maps a stored row to RegisteredClient', async () => {
    const { db } = fakeDb({ client_id: 'c1', client_name: 'Claude', redirect_uris: ['https://x/cb'], token_endpoint_auth_method: 'none', created_at: '2026-06-26T00:00:00Z' })
    const c = await getClient(db, 'c1')
    expect(c?.clientId).toBe('c1')
    expect(c?.redirectUris).toEqual(['https://x/cb'])
  })
  it('returns null when missing', async () => {
    const { db } = fakeDb(null)
    expect(await getClient(db, 'nope')).toBeNull()
  })
})
