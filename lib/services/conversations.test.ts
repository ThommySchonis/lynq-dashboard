import { describe, it, expect } from 'vitest'
import { listConversations } from '@/lib/services/conversations'

/** Records the query chain calls and returns the seeded rows. */
function fakeDb(rows: Record<string, unknown>[]) {
  const calls: Record<string, unknown> = {}
  const q: Record<string, unknown> = {}
  const chain = {
    select: (c: string) => { calls.select = c; return chain },
    eq: (c: string, v: unknown) => { (q[c] = v); return chain },
    neq: (c: string, v: unknown) => { calls[`neq_${c}`] = v; return chain },
    is: (c: string, v: unknown) => { calls[`is_${c}`] = v; return chain },
    order: () => chain,
    range: () => chain,
    then: (res: (r: { data: unknown[]; error: null }) => void) => res({ data: rows, error: null }),
  }
  const db = { from: (t: string) => { calls.table = t; return chain } }
  return { db: db as never, calls, q }
}

describe('listConversations', () => {
  it('scopes by workspace_id and returns mapped summaries', async () => {
    const { db, q } = fakeDb([
      { id: 'c1', subject: 'Hi', customer_email: 'a@b.c', customer_name: 'A', status: 'open',
        last_message_at: '2026-06-26T00:00:00Z', stores: { name: 'Shop' } },
    ])
    const out = await listConversations(db, 'w1', {})
    expect(q.workspace_id).toBe('w1')
    expect(out[0]).toMatchObject({ id: 'c1', store_name: 'Shop', tags: [] })
    expect(out[0]).not.toHaveProperty('stores')
  })

  it('filters by status when provided', async () => {
    const { db, q } = fakeDb([])
    await listConversations(db, 'w1', { status: 'closed' })
    expect(q.status).toBe('closed')
  })
})
