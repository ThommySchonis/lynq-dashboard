import { describe, it, expect, vi, beforeEach } from 'vitest'

const searchWorkspace = vi.fn()
vi.mock('@/lib/services/search', () => ({
  searchWorkspace: (...a: unknown[]): unknown => searchWorkspace(...a),
}))
vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: {} }))

import { registerSearchTools } from '@/mcp/tools/search'
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
      tool: (n: string, _s: unknown, h: Reg['handler']) => {
        tools[n] = { handler: h }
      },
    },
    tools,
  }
}

const ctx: McpToolContext = { userId: 'u1', workspaceId: 'w1', role: 'agent' }

beforeEach(() => {
  searchWorkspace.mockReset()
})

describe('registerSearchTools', () => {
  it('registers search tool', () => {
    const { server, tools } = fakeServer()
    registerSearchTools(server as never, ctx)
    expect(tools.search).toBeDefined()
  })

  it('search calls searchWorkspace scoped to workspace with q param', async () => {
    const { server, tools } = fakeServer()
    searchWorkspace.mockResolvedValue({ conversations: [{ id: 'c1' }] })
    registerSearchTools(server as never, ctx)
    await tools.search.handler({ q: 'refund' })
    expect(searchWorkspace).toHaveBeenCalledWith(expect.anything(), 'w1', { q: 'refund' })
  })

  it('search returns ok with results', async () => {
    const { server, tools } = fakeServer()
    const results = { conversations: [{ id: 'c1', subject: 'test' }] }
    searchWorkspace.mockResolvedValue(results)
    registerSearchTools(server as never, ctx)
    const r = await tools.search.handler({ q: 'refund' })
    expect(r.content[0].text).toContain('c1')
  })

  it('search returns fail on error', async () => {
    const { server, tools } = fakeServer()
    searchWorkspace.mockRejectedValue(new Error('boom'))
    registerSearchTools(server as never, ctx)
    const r = await tools.search.handler({ q: 'test' })
    expect(r.isError).toBe(true)
  })
})
