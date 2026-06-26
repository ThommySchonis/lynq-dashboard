import { describe, it, expect } from 'vitest'
import { listMacros, getMacro } from '@/lib/services/macros'

function listDb(rows: Record<string, unknown>[]) {
  const calls: Record<string, unknown> = {}
  const chain: Record<string, unknown> = {
    select: () => chain, eq: (c: string, v: unknown) => { calls[c] = v; return chain },
    is: (c: string, v: unknown) => { calls['is_' + c] = v; return chain },
    ilike: (c: string, v: unknown) => { calls['ilike_' + c] = v; return chain },
    order: () => chain,
    then: (r: (x: { data: unknown[]; error: null }) => void) => r({ data: rows, error: null }),
  }
  return { db: { from: () => chain } as never, calls }
}

describe('listMacros', () => {
  it('scopes by workspace_id, excludes archived by default, maps rows', async () => {
    const { db, calls } = listDb([{ id: 'm1', name: 'Refund', body: 'Hi {{name}}', language: 'en', tags: ['refund'], archived_at: null }])
    const out = await listMacros(db, 'w1', {})
    expect(calls.workspace_id).toBe('w1')
    expect(calls.is_archived_at).toBe(null)
    expect(out[0]).toEqual({ id: 'm1', name: 'Refund', body: 'Hi {{name}}', language: 'en', tags: ['refund'], archived: false })
  })
  it('filters by language + search', async () => {
    const { db, calls } = listDb([])
    await listMacros(db, 'w1', { language: 'nl', search: 'ship' })
    expect(calls.language).toBe('nl')
    expect(calls.ilike_name).toContain('ship')
  })
})

describe('getMacro', () => {
  it('returns null when missing', async () => {
    const chain: Record<string, unknown> = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: null, error: null }) }
    expect(await getMacro({ from: () => chain } as never, 'w1', 'x')).toBeNull()
  })
  it('maps a found row', async () => {
    const row = { id: 'm1', name: 'R', body: 'b', language: 'en', tags: null, archived_at: '2026-01-01' }
    const chain: Record<string, unknown> = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: row, error: null }) }
    const m = await getMacro({ from: () => chain } as never, 'w1', 'm1')
    expect(m).toEqual({ id: 'm1', name: 'R', body: 'b', language: 'en', tags: [], archived: true })
  })
})
