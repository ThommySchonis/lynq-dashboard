import { describe, it, expect, vi, beforeEach } from 'vitest'

const buildReplyContext = vi.fn()
vi.mock('@/lib/services/mcp-reply-context', () => ({
  buildReplyContext: (...a: unknown[]): unknown => buildReplyContext(...a),
}))

import { registerContextTools } from '@/mcp/tools/context'
import type { McpToolContext } from '@/mcp/types'

interface Reg { handler: (a: unknown) => Promise<{ content: { type: string; text: string }[]; isError?: boolean }> }
function fakeServer() {
  const tools: Record<string, Reg> = {}
  return {
    server: { registerTool: (n: string, _c: unknown, h: Reg['handler']) => { tools[n] = { handler: h } } },
    tools,
  }
}
const ctx: McpToolContext = { userId: 'u1', workspaceId: 'w1', role: 'agent' }

beforeEach(() => buildReplyContext.mockReset())

describe('registerContextTools', () => {
  it('registers get_reply_context', () => {
    const { server, tools } = fakeServer()
    registerContextTools(server as never, ctx)
    expect(tools.get_reply_context).toBeDefined()
  })

  it('returns the bundle on success', async () => {
    buildReplyContext.mockResolvedValue({ thread: { id: 'c1' }, validIntents: ['wismo'] })
    const { server, tools } = fakeServer()
    registerContextTools(server as never, ctx)
    const res = await tools.get_reply_context.handler({ conversationId: 'c1' })
    expect(res.isError).toBeUndefined()
    expect(res.content[0].text).toContain('"wismo"')
    expect(buildReplyContext).toHaveBeenCalledWith({ workspaceId: 'w1', conversationId: 'c1', storeId: undefined })
  })

  it('errors when the conversation is not found', async () => {
    buildReplyContext.mockResolvedValue(null)
    const { server, tools } = fakeServer()
    registerContextTools(server as never, ctx)
    const res = await tools.get_reply_context.handler({ conversationId: 'missing' })
    expect(res.isError).toBe(true)
  })

  it('errors when buildReplyContext throws', async () => {
    buildReplyContext.mockRejectedValueOnce(new Error('db error'))
    const { server, tools } = fakeServer()
    registerContextTools(server as never, ctx)
    const res = await tools.get_reply_context.handler({ conversationId: 'c1' })
    expect(res.isError).toBe(true)
    expect(res.content[0].text).toContain('db error')
  })
})
