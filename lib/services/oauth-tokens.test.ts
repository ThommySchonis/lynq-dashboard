import { describe, it, expect } from 'vitest'
import type { TokenStoreDb } from '@/lib/services/oauth-tokens'
import {
  hashToken, generateOpaqueToken, createTokenPair, verifyAccessToken, rotateRefreshToken,
} from '@/lib/services/oauth-tokens'


describe('hashToken', () => {
  it('is deterministic and 64 hex chars (sha-256)', () => {
    const a = hashToken('lynq_at_abc')
    expect(a).toBe(hashToken('lynq_at_abc'))
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })
  it('differs for different input', () => {
    expect(hashToken('a')).not.toBe(hashToken('b'))
  })
})

describe('generateOpaqueToken', () => {
  it('uses the prefix and is unguessably long and unique', () => {
    const t1 = generateOpaqueToken('lynq_at')
    const t2 = generateOpaqueToken('lynq_at')
    expect(t1.startsWith('lynq_at_')).toBe(true)
    expect(t1).not.toBe(t2)
    expect(t1.length).toBeGreaterThan(40)
  })
})

function fakeDb(row: Record<string, unknown> | null) {
  const updates: Record<string, unknown>[] = []
  const inserts: Record<string, unknown>[] = []
  const db = {
    from() {
      return {
        insert(r: Record<string, unknown>) { inserts.push(r); return { select() { return { single: async () => ({ data: { id: 'tok_1' }, error: null }) } } } },
        select() {
          return {
            eq() {
              return {
                is() { return { maybeSingle: async () => ({ data: row, error: null }) } },
                maybeSingle: async () => ({ data: row, error: null }),
              }
            },
          }
        },
        update(u: Record<string, unknown>) { updates.push(u); return { eq: async () => ({ error: null }) } },
      }
    },
  }
  return { db: db as unknown as TokenStoreDb, updates, inserts }
}

describe('createTokenPair', () => {
  it('returns hashed-stored pair with future expiries', async () => {
    const { db, inserts } = fakeDb(null)
    const pair = await createTokenPair(db, { clientId: 'c1', userId: 'u1', workspaceId: 'w1' })
    expect(pair.accessToken.startsWith('lynq_at_')).toBe(true)
    expect(pair.refreshToken.startsWith('lynq_rt_')).toBe(true)
    expect(new Date(pair.accessExpiresAt).getTime()).toBeGreaterThan(Date.now())
    expect(pair.tokenId).toBe('tok_1')

    // The stored values must be hashes, not plaintext tokens.
    const stored = inserts[0]
    expect(stored.access_token_hash).toBe(hashToken(pair.accessToken))
    expect(stored.refresh_token_hash).toBe(hashToken(pair.refreshToken))
    expect(stored.access_token_hash).not.toBe(pair.accessToken)
    expect(stored.refresh_token_hash).not.toBe(pair.refreshToken)
  })
})

describe('verifyAccessToken', () => {
  const base = {
    id: 'tok_1', client_id: 'c1', user_id: 'u1', workspace_id: 'w1',
    scope: null, revoked_at: null,
  }
  it('rejects non-access-token prefixes without a db call', async () => {
    const { db } = fakeDb(null)
    expect(await verifyAccessToken(db, 'lynq_rt_x')).toBeNull()
  })
  it('returns context for a valid token and bumps last_used_at', async () => {
    const { db, updates } = fakeDb({ ...base, access_expires_at: new Date(Date.now() + 1000).toISOString() })
    const v = await verifyAccessToken(db, 'lynq_at_valid')
    expect(v?.workspaceId).toBe('w1')
    expect(updates[0]).toHaveProperty('last_used_at')
  })
  it('returns null for an expired token', async () => {
    const { db } = fakeDb({ ...base, access_expires_at: new Date(Date.now() - 1000).toISOString() })
    expect(await verifyAccessToken(db, 'lynq_at_old')).toBeNull()
  })
  it('returns null for a revoked token', async () => {
    const { db } = fakeDb({ ...base, revoked_at: new Date().toISOString(), access_expires_at: new Date(Date.now() + 1000).toISOString() })
    expect(await verifyAccessToken(db, 'lynq_at_revoked')).toBeNull()
  })
})

describe('rotateRefreshToken', () => {
  const valid = {
    id: 'tok_old', client_id: 'c1', user_id: 'u1', workspace_id: 'w1',
    scope: null, revoked_at: null,
    refresh_expires_at: new Date(Date.now() + 1000).toISOString(),
  }
  function rotateDb(row: Record<string, unknown> | null) {
    const updates: Record<string, unknown>[] = []
    const inserted: Record<string, unknown>[] = []
    const db = {
      from() {
        return {
          insert(r: Record<string, unknown>) { inserted.push(r); return { select() { return { single: async () => ({ data: { id: 'tok_new' }, error: null }) } } } },
          select() { return { eq() { return { maybeSingle: async () => ({ data: row, error: null }) } } } },
          update(u: Record<string, unknown>) { updates.push(u); return { eq: async () => ({ error: null }) } },
        }
      },
    }
    return { db: db as unknown as TokenStoreDb, updates, inserted }
  }

  it('rejects a non-refresh prefix without a db call', async () => {
    const { db } = rotateDb(null)
    expect(await rotateRefreshToken(db, 'lynq_at_x')).toBeNull()
  })
  it('returns a new pair and revokes the old token on valid refresh', async () => {
    const { db, updates } = rotateDb(valid)
    const pair = await rotateRefreshToken(db, 'lynq_rt_valid')
    expect(pair?.accessToken.startsWith('lynq_at_')).toBe(true)
    expect(pair?.refreshToken.startsWith('lynq_rt_')).toBe(true)
    expect(updates.some((u) => 'revoked_at' in u)).toBe(true) // old token revoked (rotation)
  })
  it('returns null for an expired refresh token', async () => {
    const { db } = rotateDb({ ...valid, refresh_expires_at: new Date(Date.now() - 1000).toISOString() })
    expect(await rotateRefreshToken(db, 'lynq_rt_old')).toBeNull()
  })
  it('returns null for a revoked refresh token', async () => {
    const { db } = rotateDb({ ...valid, revoked_at: new Date().toISOString() })
    expect(await rotateRefreshToken(db, 'lynq_rt_revoked')).toBeNull()
  })
})
