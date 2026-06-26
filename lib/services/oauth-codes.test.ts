import { describe, it, expect } from 'vitest'
import type { OAuthCodesDb } from '@/lib/services/oauth-codes'
import { createAuthCode, consumeAuthCode } from '@/lib/services/oauth-codes'

const record = {
  clientId: 'c1', userId: 'u1', workspaceId: 'w1',
  redirectUri: 'https://claude.ai/cb', codeChallenge: 'chal', scope: null,
}

function fakeDb(row: Record<string, unknown> | null) {
  const inserted: Record<string, unknown>[] = []
  const deleted: string[] = []
  const db = {
    from() {
      return {
        insert(r: Record<string, unknown>) { inserted.push(r); return Promise.resolve({ error: null }) },
        select() { return { eq() { return { maybeSingle: async () => ({ data: row, error: null }) } } } },
        delete() { return { eq(_c: string, v: string) { deleted.push(v); return Promise.resolve({ error: null }) } } },
      }
    },
  }
  return { db: db as unknown as OAuthCodesDb, inserted, deleted }
}

describe('createAuthCode', () => {
  it('returns a plaintext code and stores its hash + metadata', async () => {
    const { db, inserted } = fakeDb(null)
    const code = await createAuthCode(db, record)
    expect(code.startsWith('lynq_ac_')).toBe(true)
    expect(inserted[0]).toHaveProperty('code_hash')
    expect(inserted[0].client_id).toBe('c1')
    expect(inserted[0]).not.toHaveProperty('code') // never store plaintext
  })
})

describe('consumeAuthCode', () => {
  it('returns the record and deletes the row (single-use) for a valid code', async () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    const { db, deleted } = fakeDb({ code_hash: 'h', client_id: 'c1', user_id: 'u1', workspace_id: 'w1', redirect_uri: 'https://claude.ai/cb', code_challenge: 'chal', scope: null, expires_at: future })
    const out = await consumeAuthCode(db, 'lynq_ac_valid')
    expect(out?.clientId).toBe('c1')
    expect(out?.codeChallenge).toBe('chal')
    expect(deleted.length).toBe(1) // row deleted after consumption
  })
  it('returns null for an expired code', async () => {
    const past = new Date(Date.now() - 1000).toISOString()
    const { db } = fakeDb({ code_hash: 'h', client_id: 'c1', user_id: 'u1', workspace_id: 'w1', redirect_uri: 'x', code_challenge: 'c', scope: null, expires_at: past })
    expect(await consumeAuthCode(db, 'lynq_ac_old')).toBeNull()
  })
  it('returns null for a missing code', async () => {
    const { db } = fakeDb(null)
    expect(await consumeAuthCode(db, 'lynq_ac_missing')).toBeNull()
  })
})
