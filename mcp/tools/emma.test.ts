import { describe, it, expect, vi, beforeEach } from 'vitest'

const getAiSettings = vi.fn()
const upsertPolicies = vi.fn()
const upsertScenario = vi.fn()
vi.mock('@/lib/services/ai-config', () => ({
  getAiSettings: (...a: unknown[]): unknown => getAiSettings(...a),
  upsertPolicies: (...a: unknown[]): unknown => upsertPolicies(...a),
  upsertScenario: (...a: unknown[]): unknown => upsertScenario(...a),
}))

import { registerEmmaTools } from '@/mcp/tools/emma'
import type { McpToolContext } from '@/mcp/types'

interface Reg {
  handler: (a: unknown) => Promise<{ content: { type: string; text: string }[]; isError?: boolean }>
}

function fakeServer() {
  const tools: Record<string, Reg> = {}
  return {
    server: {
      registerTool: (n: string, _c: unknown, h: Reg['handler']) => {
        tools[n] = { handler: h }
      },
    },
    tools,
  }
}

beforeEach(() => {
  getAiSettings.mockReset()
  upsertPolicies.mockReset()
  upsertScenario.mockReset()
})

describe('registerEmmaTools', () => {
  it('registers all three tools', () => {
    const { server, tools } = fakeServer()
    const ctx: McpToolContext = { userId: 'u1', workspaceId: 'w1', role: 'admin' }
    registerEmmaTools(server as never, ctx)
    expect(tools.get_ai_settings).toBeDefined()
    expect(tools.update_policies).toBeDefined()
    expect(tools.update_scenario).toBeDefined()
  })

  describe('get_ai_settings', () => {
    it('calls getAiSettings with workspace and optional storeId (ungated)', async () => {
      const { server, tools } = fakeServer()
      const ctx: McpToolContext = { userId: 'u1', workspaceId: 'w1', role: 'observer' }
      getAiSettings.mockResolvedValue({
        storeId: 's1',
        isComplete: true,
        policies: { brand_name: 'Acme' },
        scenarios: [],
        lessons: [],
        examples: [],
        systemPrompt: 'SYSTEM',
      })
      registerEmmaTools(server as never, ctx)
      const result = await tools.get_ai_settings.handler({ storeId: 's1' })
      expect(result.isError).toBeUndefined()
      expect(getAiSettings).toHaveBeenCalledWith('w1', 's1')
    })

    it('works for observer role (no gate)', async () => {
      const { server, tools } = fakeServer()
      const ctx: McpToolContext = { userId: 'u1', workspaceId: 'w1', role: 'observer' }
      getAiSettings.mockResolvedValue({
        storeId: 's1',
        isComplete: false,
        policies: null,
        scenarios: [],
        lessons: [],
        examples: [],
        systemPrompt: null,
      })
      registerEmmaTools(server as never, ctx)
      const result = await tools.get_ai_settings.handler({})
      expect(result.isError).toBeUndefined()
      expect(getAiSettings).toHaveBeenCalledWith('w1', undefined)
    })
  })

  describe('update_policies', () => {
    it('returns isError when role is observer (not owner/admin)', async () => {
      const { server, tools } = fakeServer()
      const ctx: McpToolContext = { userId: 'u1', workspaceId: 'w1', role: 'observer' }
      registerEmmaTools(server as never, ctx)
      const result = await tools.update_policies.handler({ tone_of_voice: 'warm' })
      expect(result.isError).toBe(true)
      expect(upsertPolicies).not.toHaveBeenCalled()
    })

    it('calls upsertPolicies with workspace, storeId, and patch when role is admin', async () => {
      const { server, tools } = fakeServer()
      const ctx: McpToolContext = { userId: 'u1', workspaceId: 'w1', role: 'admin' }
      upsertPolicies.mockResolvedValue(undefined)
      registerEmmaTools(server as never, ctx)
      const result = await tools.update_policies.handler({ tone_of_voice: 'warm' })
      expect(result.isError).toBeUndefined()
      expect(upsertPolicies).toHaveBeenCalledWith('w1', undefined, { tone_of_voice: 'warm' })
    })

    it('returns isError when no fields are provided', async () => {
      const { server, tools } = fakeServer()
      const ctx: McpToolContext = { userId: 'u1', workspaceId: 'w1', role: 'admin' }
      registerEmmaTools(server as never, ctx)
      const result = await tools.update_policies.handler({ storeId: 's1' })
      expect(result.isError).toBe(true)
      expect(upsertPolicies).not.toHaveBeenCalled()
    })
  })

  describe('update_scenario', () => {
    it('returns isError when role is observer (not owner/admin)', async () => {
      const { server, tools } = fakeServer()
      const ctx: McpToolContext = { userId: 'u1', workspaceId: 'w1', role: 'observer' }
      registerEmmaTools(server as never, ctx)
      const result = await tools.update_scenario.handler({
        scenario_key: 'refund',
        approach: 'be kind',
      })
      expect(result.isError).toBe(true)
      expect(upsertScenario).not.toHaveBeenCalled()
    })

    it('calls upsertScenario with workspace, storeId, scenarioKey, and patch when role is admin', async () => {
      const { server, tools } = fakeServer()
      const ctx: McpToolContext = { userId: 'u1', workspaceId: 'w1', role: 'admin' }
      upsertScenario.mockResolvedValue(undefined)
      registerEmmaTools(server as never, ctx)
      const result = await tools.update_scenario.handler({
        scenario_key: 'refund',
        approach: 'be kind',
        enabled: true,
      })
      expect(result.isError).toBeUndefined()
      expect(upsertScenario).toHaveBeenCalledWith('w1', undefined, 'refund', { approach: 'be kind', enabled: true })
    })

    it('returns isError when no fields are provided (only scenario_key)', async () => {
      const { server, tools } = fakeServer()
      const ctx: McpToolContext = { userId: 'u1', workspaceId: 'w1', role: 'admin' }
      registerEmmaTools(server as never, ctx)
      const result = await tools.update_scenario.handler({ scenario_key: 'refund' })
      expect(result.isError).toBe(true)
      expect(upsertScenario).not.toHaveBeenCalled()
    })
  })
})
