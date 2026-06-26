import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { listMacros, getMacro, type MacroFilters } from '@/lib/services/macros'
import { ok, fail } from '@/mcp/tools/inbox'
import type { McpToolContext } from '@/mcp/types'

export function registerMacroTools(server: McpServer, ctx: McpToolContext): void {
  server.registerTool(
    'list_macros',
    {
      description:
        'List saved reply macros (canned responses) in the workspace. Use a macro body as the basis for a reply.',
      inputSchema: {
        search: z.string().optional(),
        language: z.string().optional(),
        includeArchived: z.boolean().optional(),
      },
    },
    async (args: MacroFilters) => {
      try {
        return ok(await listMacros(supabaseAdmin as never, ctx.workspaceId, args))
      } catch (e) {
        return fail(`list_macros failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    },
  )

  server.registerTool(
    'get_macro',
    {
      description: 'Get one macro by id (full body).',
      inputSchema: { id: z.string() },
    },
    async (args: { id: string }) => {
      try {
        const m = await getMacro(supabaseAdmin as never, ctx.workspaceId, args.id)
        return m ? ok(m) : fail(`Macro ${args.id} not found.`)
      } catch (e) {
        return fail(`get_macro failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    },
  )
}
