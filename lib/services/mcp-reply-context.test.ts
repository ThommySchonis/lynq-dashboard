import { vi } from 'vitest'

const getConversation = vi.fn()
const getAiSettings = vi.fn()
const listMacros = vi.fn()
const lookupCustomerForWorkspace = vi.fn()
const loadAutonomyConfig = vi.fn()
vi.mock('@/lib/services/conversations', () => ({ getConversation: (...a: unknown[]): unknown => getConversation(...a) }))
vi.mock('@/lib/services/ai-config', () => ({ getAiSettings: (...a: unknown[]): unknown => getAiSettings(...a) }))
vi.mock('@/lib/services/macros', () => ({ listMacros: (...a: unknown[]): unknown => listMacros(...a) }))
vi.mock('@/lib/services/mcp-shopify', () => ({ lookupCustomerForWorkspace: (...a: unknown[]): unknown => lookupCustomerForWorkspace(...a) }))
vi.mock('@/lib/services/mcp-autonomy-gate', () => ({ loadAutonomyConfig: (...a: unknown[]): unknown => loadAutonomyConfig(...a) }))
vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: {} }))

import { describe, it, expect, beforeEach } from 'vitest'
import { rankMacros } from '@/lib/services/mcp-reply-context'
import type { MacroSummary } from '@/lib/services/macros'

function macro(p: Partial<MacroSummary> & { id: string }): MacroSummary {
  return { name: '', body: '', language: 'en', tags: [], archived: false, ...p }
}

describe('rankMacros', () => {
  it('ranks keyword-overlapping macros above unrelated ones', () => {
    const macros = [
      macro({ id: 'a', name: 'Refund policy', body: 'We process refund requests within 14 days', tags: ['refund'] }),
      macro({ id: 'b', name: 'Welcome', body: 'Thanks for shopping with us', tags: [] }),
    ]
    const ranked = rankMacros(macros, { text: 'I want a refund on my order', language: 'en' })
    expect(ranked[0].id).toBe('a')
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score)
  })

  it('adds a language-match bonus', () => {
    const macros = [
      macro({ id: 'en1', language: 'en', name: 'Hello' }),
      macro({ id: 'de1', language: 'de', name: 'Hello' }),
    ]
    const ranked = rankMacros(macros, { text: 'unrelated', language: 'en' })
    expect(ranked[0].id).toBe('en1')
  })

  it('returns all macros with a numeric score even at zero overlap', () => {
    const macros = [macro({ id: 'x', name: 'Zzz', body: 'qqq' })]
    const ranked = rankMacros(macros, { text: 'nothing matches here', language: 'fr' })
    expect(ranked).toHaveLength(1)
    expect(typeof ranked[0].score).toBe('number')
  })
})

import { buildReplyContext } from '@/lib/services/mcp-reply-context'

describe('buildReplyContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when the conversation is not found', async () => {
    getConversation.mockResolvedValue(null)
    const r = await buildReplyContext({ workspaceId: 'w1', conversationId: 'missing' })
    expect(r).toBeNull()
  })

  it('bundles thread, settings, ranked macros, order, and autonomy snapshot', async () => {
    getConversation.mockResolvedValue({
      id: 'c1', subject: 'Where is my order', customer_email: 'a@b.com',
      status: 'open', shopify_customer_id: null,
      messages: [{ id: 'x', from_email: 'a@b.com', from_name: null, body_text: 'I need a refund for my order', body_html: null, is_outbound: false, created_at: 't' }],
    })
    getAiSettings.mockResolvedValue({
      storeId: 's1', isComplete: true, systemPrompt: 'PROMPT',
      policies: { brand_name: 'Acme' },
      scenarios: [{ scenario_key: 'refund_or_cancel', autonomy_pct: 0 }, { scenario_key: 'wismo', autonomy_pct: 80 }],
      lessons: [], examples: [],
    })
    listMacros.mockResolvedValue([
      { id: 'm1', name: 'Refund', body: 'refund within 14 days', language: 'en', tags: ['refund'], archived: false },
      { id: 'm2', name: 'Welcome', body: 'hello', language: 'en', tags: [], archived: false },
    ])
    lookupCustomerForWorkspace.mockResolvedValue({ orders: [] })
    loadAutonomyConfig.mockResolvedValue({
      rules: { master_enabled: true, confidence_threshold: 0.85, global_block_intents: ['refund_or_cancel'] },
      storeAutoSendEnabled: true,
    })

    const r = await buildReplyContext({ workspaceId: 'w1', conversationId: 'c1' })
    expect(r).not.toBeNull()
    expect(r!.aiSettings.systemPrompt).toBe('PROMPT')
    expect(r!.suggestedMacros[0].id).toBe('m1') // refund macro ranks first
    expect(r!.suggestedMacros.length).toBeLessThanOrEqual(5)
    expect(r!.order).toEqual({ orders: [] })
    expect(r!.autonomy.store_auto_send_enabled).toBe(true)
    expect(r!.autonomy.perScenarioAutonomyPct.refund_or_cancel).toBe(0)
    expect(r!.validIntents).toContain('wismo')
  })

  it('sets order to null when the conversation has no customer email', async () => {
    getConversation.mockResolvedValue({ id: 'c1', subject: null, customer_email: null, status: 'open', shopify_customer_id: null, messages: [] })
    getAiSettings.mockResolvedValue({ storeId: 's1', isComplete: false, systemPrompt: null, policies: null, scenarios: [], lessons: [], examples: [] })
    listMacros.mockResolvedValue([])
    loadAutonomyConfig.mockResolvedValue({ rules: { master_enabled: false, confidence_threshold: 0.85, global_block_intents: [] }, storeAutoSendEnabled: false })
    const r = await buildReplyContext({ workspaceId: 'w1', conversationId: 'c1' })
    expect(r!.order).toBeNull()
    expect(lookupCustomerForWorkspace).not.toHaveBeenCalled()
  })
})
