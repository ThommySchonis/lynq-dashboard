import { describe, it, expect } from 'vitest'
import { listUserConnections, revokeUserConnection } from '@/lib/services/oauth-connections'

describe('listUserConnections', () => {
  it('groups active tokens by client into one entry, newest activity, with client name', async () => {
    const tokenRows = [
      { client_id: 'c1', created_at: '2026-06-01T00:00:00Z', last_used_at: '2026-06-10T00:00:00Z' },
      { client_id: 'c1', created_at: '2026-06-05T00:00:00Z', last_used_at: '2026-06-20T00:00:00Z' },
      { client_id: 'c2', created_at: '2026-06-02T00:00:00Z', last_used_at: null },
    ]
    const clientRows = [{ client_id: 'c1', client_name: 'Claude' }, { client_id: 'c2', client_name: 'ChatGPT' }]
    const db = {
      from(table: string) {
        if (table === 'oauth_tokens') return { select: () => ({ eq: () => ({ is: async () => ({ data: tokenRows, error: null }) }) }) }
        return { select: () => ({ in: async () => ({ data: clientRows, error: null }) }) } // oauth_clients
      },
    } as never
    const out = await listUserConnections(db, 'u1')
    expect(out).toHaveLength(2)
    const c1 = out.find((a) => a.clientId === 'c1')
    expect(c1).toMatchObject({ clientName: 'Claude', connectedAt: '2026-06-01T00:00:00Z', lastUsedAt: '2026-06-20T00:00:00Z' })
    expect(out.find((a) => a.clientId === 'c2')?.clientName).toBe('ChatGPT')
  })
  it('returns [] when the user has no active tokens', async () => {
    const db = { from: () => ({ select: () => ({ eq: () => ({ is: async () => ({ data: [], error: null }) }) }) }) } as never
    expect(await listUserConnections(db, 'u1')).toEqual([])
  })
})

describe('revokeUserConnection', () => {
  it('revokes all active tokens for the user+client and returns the count', async () => {
    const eqs: [string, unknown][] = []
    const chain: Record<string, unknown> = {
      eq: (c: string, v: unknown) => { eqs.push([c, v]); return chain },
      is: (c: string, v: unknown) => { eqs.push([`is_${c}`, v]); return chain },
      select: () => Promise.resolve({ data: [{ id: 'a' }, { id: 'b' }], error: null }),
    }
    const db = { from: () => ({ update: () => chain }) } as never
    const n = await revokeUserConnection(db, 'u1', 'c1')
    expect(n).toBe(2)
    expect(eqs).toEqual(expect.arrayContaining([['user_id', 'u1'], ['client_id', 'c1'], ['is_revoked_at', null]]))
  })
})
