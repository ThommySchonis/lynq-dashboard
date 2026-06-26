import { describe, it, expect, vi, beforeEach } from 'vitest'

const listMacros = vi.fn()
const getMacro = vi.fn()
vi.mock('@/lib/services/macros', () => ({
  listMacros: (...a: unknown[]): unknown => listMacros(...a),
  getMacro: (...a: unknown[]): unknown => getMacro(...a),
}))
vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: {} }))

import { registerMacroTools } from '@/mcp/tools/macros'
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
  listMacros.mockReset()
  getMacro.mockReset()
})

describe('registerMacroTools', () => {
  it('registers both tools', () => {
    const { server, tools } = fakeServer()
    registerMacroTools(server as never, ctx)
    expect(tools.list_macros).toBeDefined()
    expect(tools.get_macro).toBeDefined()
  })

  it('list_macros calls service scoped to workspace', async () => {
    const { server, tools } = fakeServer()
    listMacros.mockResolvedValue([{ id: 'm1' }])
    registerMacroTools(server as never, ctx)
    await tools.list_macros.handler({ language: 'en' })
    expect(listMacros).toHaveBeenCalledWith(expect.anything(), 'w1', { language: 'en' })
  })

  it('get_macro returns isError when not found', async () => {
    const { server, tools } = fakeServer()
    getMacro.mockResolvedValue(null)
    registerMacroTools(server as never, ctx)
    const r = await tools.get_macro.handler({ id: 'x' })
    expect(r.isError).toBe(true)
  })
})
