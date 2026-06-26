import { describe, it, expect, vi, beforeEach } from 'vitest'

const listConversations = vi.fn()
vi.mock('@/lib/services/conversations', () => ({
  listConversations: (...a: unknown[]): unknown => listConversations(...a),
}))
vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: {} }))

import { registerLynqTools } from '@/mcp/server'
import type { McpToolContext } from '@/mcp/types'

interface Registered {
  handler: (args: unknown) => Promise<{ content: { type: string; text: string }[]; isError?: boolean }>
}

function fakeServer() {
  const tools: Record<string, Registered> = {}
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Registered['handler']) => {
      tools[name] = { handler }
    },
    tool: (name: string, _schema: unknown, handler: Registered['handler']) => {
      tools[name] = { handler }
    },
  }
  return { server, tools }
}

const ctx: McpToolContext = { userId: 'u1', workspaceId: 'w1', role: 'agent' }

beforeEach(() => { listConversations.mockReset() })

describe('registerLynqTools', () => {
  it('registers list_conversations', () => {
    const { server, tools } = fakeServer()
    registerLynqTools(server as never, ctx)
    expect(tools.list_conversations).toBeDefined()
  })

  it('list_conversations calls the service scoped to the ctx workspace', async () => {
    const { server, tools } = fakeServer()
    listConversations.mockResolvedValue([{ id: 'c1', subject: 'Hi', status: 'open', tags: [] }])
    registerLynqTools(server as never, ctx)
    const res = await tools.list_conversations.handler({ status: 'open' })
    expect(listConversations).toHaveBeenCalledWith(expect.anything(), 'w1', { status: 'open' })
    expect(res.content[0].type).toBe('text')
    expect(res.content[0].text).toContain('c1')
  })

  it('list_conversations returns an error result when the service throws', async () => {
    const { server, tools } = fakeServer()
    listConversations.mockRejectedValue(new Error('boom'))
    registerLynqTools(server as never, ctx)
    const res = await tools.list_conversations.handler({})
    expect(res.isError).toBe(true)
  })
})
