import { describe, it, expect, vi, beforeEach } from 'vitest'

const resolveStoreIdForThread = vi.fn()
const getOnboardingStatus = vi.fn()
vi.mock('@/lib/services/ai-onboarding', () => ({
  resolveStoreIdForThread: (...a: unknown[]): unknown => resolveStoreIdForThread(...a),
  getOnboardingStatus: (...a: unknown[]): unknown => getOnboardingStatus(...a),
}))

// Table-dispatch Supabase mock: each table resolves to a canned single/maybeSingle row.
const tableData: Record<string, { data: unknown }> = {}
vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from(table: string) {
      const result = tableData[table] ?? { data: null }
      const b: Record<string, unknown> = {}
      b.select = () => b
      b.eq = () => b
      b.single = () => Promise.resolve(result)
      b.maybeSingle = () => Promise.resolve(result)
      return b
    },
  },
}))

import { evaluateMcpSend } from '@/lib/services/mcp-autonomy-gate'

beforeEach(() => {
  resolveStoreIdForThread.mockReset()
  getOnboardingStatus.mockReset()
  for (const k of Object.keys(tableData)) delete tableData[k]
})

function setup(opts: {
  storeId?: string | null
  autoSend?: boolean
  rules?: unknown
  scenarios?: Array<{ scenario_key: string; autonomy_pct: number | null }>
}) {
  resolveStoreIdForThread.mockResolvedValue(opts.storeId !== undefined ? opts.storeId : 's1')
  tableData['stores'] = { data: { ai_auto_send_enabled: opts.autoSend ?? true } }
  tableData['ai_autonomy_rules'] = { data: opts.rules ? { config: opts.rules } : null }
  getOnboardingStatus.mockResolvedValue({ isComplete: true, policies: {}, scenarios: opts.scenarios ?? [] })
}

describe('evaluateMcpSend', () => {
  it('blocks store_disabled when the store toggle is off', async () => {
    setup({ autoSend: false })
    const d = await evaluateMcpSend({ workspaceId: 'w1', conversationId: 'c1', intent: 'wismo', confidence: 1, shouldEscalate: false })
    expect(d).toEqual({ allowed: false, reason: 'store_disabled', storeId: 's1' })
  })

  it('blocks store_disabled when no store resolves', async () => {
    setup({ storeId: null })
    const d = await evaluateMcpSend({ workspaceId: 'w1', conversationId: 'c1', intent: 'wismo', confidence: 1, shouldEscalate: false })
    expect(d).toEqual({ allowed: false, reason: 'store_disabled', storeId: null })
  })

  it('blocks blocked_intent for a globally blocked intent', async () => {
    setup({ rules: { master_enabled: true, confidence_threshold: 0.5, global_block_intents: ['refund_or_cancel'] } })
    const d = await evaluateMcpSend({ workspaceId: 'w1', conversationId: 'c1', intent: 'refund_or_cancel', confidence: 1, shouldEscalate: false })
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe('blocked_intent')
  })

  it('blocks confidence_low when confidence is under the threshold', async () => {
    setup({ rules: { master_enabled: true, confidence_threshold: 0.9, global_block_intents: [] } })
    const d = await evaluateMcpSend({ workspaceId: 'w1', conversationId: 'c1', intent: 'wismo', confidence: 0.3, shouldEscalate: false })
    expect(d.reason).toBe('confidence_low')
  })

  it('allows a confident, unblocked send', async () => {
    setup({ rules: { master_enabled: true, confidence_threshold: 0.5, global_block_intents: [] }, scenarios: [{ scenario_key: 'wismo', autonomy_pct: 50 }] })
    const d = await evaluateMcpSend({ workspaceId: 'w1', conversationId: 'c1', intent: 'wismo', confidence: 0.95, shouldEscalate: false })
    expect(d).toEqual({ allowed: true, reason: null, storeId: 's1' })
  })
})
