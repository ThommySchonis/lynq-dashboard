import { describe, it, expect, vi, beforeEach } from 'vitest'

const listStores = vi.fn()
const getOnboardingStatus = vi.fn()
const getEnabledLessons = vi.fn()
const getExamples = vi.fn()
const buildEmmaSystemPrompt = vi.fn()

let dbHolder: Record<string, unknown>

vi.mock('@/lib/services/stores', () => ({ listStores: (...a: unknown[]): unknown => listStores(...a) }))
vi.mock('@/lib/services/ai-onboarding', () => ({
  getOnboardingStatus: (...a: unknown[]): unknown => getOnboardingStatus(...a),
  getEnabledLessons: (...a: unknown[]): unknown => getEnabledLessons(...a),
  getExamples: (...a: unknown[]): unknown => getExamples(...a),
}))
vi.mock('@/lib/services/ai-prompt-builder', () => ({ buildEmmaSystemPrompt: (...a: unknown[]): unknown => buildEmmaSystemPrompt(...a) }))
vi.mock('@/lib/supabaseAdmin', () => ({ get supabaseAdmin() { return dbHolder } }))

import { resolveStoreId, getAiSettings, upsertPolicies, upsertScenario } from '@/lib/services/ai-config'

beforeEach(() => {
  listStores.mockReset()
  getOnboardingStatus.mockReset()
  getEnabledLessons.mockReset()
  getExamples.mockReset()
  buildEmmaSystemPrompt.mockReset()
  // Default: the workspace owns store1 + store9. Tests that exercise the
  // default-store selection override this with their own list.
  listStores.mockResolvedValue([
    { id: 'store1', shopify_connected_at: null },
    { id: 'store9', shopify_connected_at: null },
  ])
})

describe('resolveStoreId', () => {
  it('returns an explicit storeId that belongs to the workspace', async () => {
    expect(await resolveStoreId('w1', 'store9')).toBe('store9')
  })
  it('throws when an explicit storeId is not in the workspace', async () => {
    listStores.mockResolvedValue([{ id: 'store1', shopify_connected_at: null }])
    await expect(resolveStoreId('w1', 'foreign-store')).rejects.toThrow(/not in this workspace/i)
  })
  it('prefers the first connected store', async () => {
    listStores.mockResolvedValue([{ id: 's1', shopify_connected_at: null }, { id: 's2', shopify_connected_at: '2026-01-01' }])
    expect(await resolveStoreId('w1')).toBe('s2')
  })
  it('falls back to the first store when none connected', async () => {
    listStores.mockResolvedValue([{ id: 's1', shopify_connected_at: null }])
    expect(await resolveStoreId('w1')).toBe('s1')
  })
  it('throws when the workspace has no store', async () => {
    listStores.mockResolvedValue([])
    await expect(resolveStoreId('w1')).rejects.toThrow(/no .*store/i)
  })
})

describe('getAiSettings', () => {
  it('bundles status + lessons + examples + built prompt for a configured store', async () => {
    getOnboardingStatus.mockResolvedValue({ isComplete: true, policies: { brand_name: 'Acme' }, scenarios: [{ scenario_key: 'refund' }] })
    getEnabledLessons.mockResolvedValue([{ id: 'l1' }])
    getExamples.mockResolvedValue([{ id: 'e1' }])
    buildEmmaSystemPrompt.mockReturnValue('SYSTEM PROMPT')
    const s = await getAiSettings('w1', 'store1')
    expect(s.storeId).toBe('store1')
    expect(s.policies).toEqual({ brand_name: 'Acme' })
    expect(s.systemPrompt).toBe('SYSTEM PROMPT')
    expect(buildEmmaSystemPrompt).toHaveBeenCalledWith({ brand_name: 'Acme' }, [{ scenario_key: 'refund' }], [{ id: 'l1' }], [{ id: 'e1' }])
  })
  it('returns null systemPrompt when policies are not configured', async () => {
    getOnboardingStatus.mockResolvedValue({ isComplete: false, policies: null, scenarios: [] })
    getEnabledLessons.mockResolvedValue([])
    getExamples.mockResolvedValue([])
    const s = await getAiSettings('w1', 'store1')
    expect(s.policies).toBeNull()
    expect(s.systemPrompt).toBeNull()
    expect(buildEmmaSystemPrompt).not.toHaveBeenCalled()
  })
})

// A fake supabaseAdmin where existence is controlled by `existing`.
function aiDb(existing: Record<string, unknown> | null) {
  const ops: { op: string; table: string; payload?: Record<string, unknown>; eqs: [string, unknown][] }[] = []
  function table(name: string) {
    const eqs: [string, unknown][] = []
    const api: Record<string, unknown> = {
      select: () => api,
      eq: (c: string, v: unknown) => { eqs.push([c, v]); return api },
      maybeSingle: async () => ({ data: existing, error: null }),
      update: (payload: Record<string, unknown>) => {
        const updateEqs: [string, unknown][] = [...eqs]
        ops.push({ op: 'update', table: name, payload, eqs: updateEqs })
        const u: Record<string, unknown> = {
          eq: (c: string, v: unknown) => {
            updateEqs.push([c, v])
            return u
          },
          then: (r: (x: { error: null }) => void) => r({ error: null }),
        }
        return u
      },
      insert: (payload: Record<string, unknown>) => {
        ops.push({ op: 'insert', table: name, payload, eqs: [...eqs] })
        return Promise.resolve({ error: null })
      },
    }
    return api
  }
  return { db: { from: (n: string) => table(n) } as never, ops }
}

describe('upsertPolicies', () => {
  it('UPDATEs when a policies row exists, scoped to workspace+store', async () => {
    const { db, ops } = aiDb({ id: 'p1' })
    dbHolder = db
    await upsertPolicies('w1', 'store1', { tone_of_voice: 'warm' })
    const op = ops.find((o) => o.table === 'ai_policies')
    expect(op?.op).toBe('update')
    expect(op?.payload).toMatchObject({ tone_of_voice: 'warm' })
    expect(op?.eqs).toEqual(expect.arrayContaining([['workspace_id', 'w1'], ['store_id', 'store1']]))
  })
  it('INSERTs when no policies row exists, including workspace+store ids', async () => {
    const { db, ops } = aiDb(null)
    dbHolder = db
    await upsertPolicies('w1', 'store1', { brand_name: 'Acme' })
    const op = ops.find((o) => o.table === 'ai_policies')
    expect(op?.op).toBe('insert')
    expect(op?.payload).toMatchObject({ workspace_id: 'w1', store_id: 'store1', brand_name: 'Acme' })
  })
})

describe('upsertScenario', () => {
  it('UPDATEs an existing scenario row scoped to workspace+store+scenario_key', async () => {
    const { db, ops } = aiDb({ id: 's1' })
    dbHolder = db
    await upsertScenario('w1', 'store1', 'refund', { approach: 'be kind', enabled: true })
    const op = ops.find((o) => o.table === 'ai_scenarios')
    expect(op?.op).toBe('update')
    expect(op?.payload).toMatchObject({ approach: 'be kind', enabled: true })
    expect(op?.eqs).toEqual(expect.arrayContaining([['workspace_id', 'w1'], ['store_id', 'store1'], ['scenario_key', 'refund']]))
  })
  it('INSERTs a new scenario row with the scenario_key', async () => {
    const { db, ops } = aiDb(null)
    dbHolder = db
    await upsertScenario('w1', 'store1', 'refund', { approach: 'x' })
    const op = ops.find((o) => o.table === 'ai_scenarios')
    expect(op?.op).toBe('insert')
    expect(op?.payload).toMatchObject({ workspace_id: 'w1', store_id: 'store1', scenario_key: 'refund', approach: 'x' })
  })
})
