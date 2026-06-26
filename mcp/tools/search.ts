import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { searchWorkspace, type SearchParams } from '@/lib/services/search'
import { ok, fail } from '@/mcp/tools/inbox'
import type { McpToolContext } from '@/mcp/types'

export function registerSearchTools(server: McpServer, ctx: McpToolContext): void {
  server.registerTool(
    'search',
    {
      description: 'Search the workspace across conversations, messages, and contacts. Optional filters: types, status, assignee, date range.',
      inputSchema: {
        q: z.string().optional(),
        types: z.array(z.enum(['conversations', 'messages', 'contacts'])).optional(),
        status: z.array(z.string()).optional(),
        assignee: z.array(z.string()).optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().int().min(1).max(25).optional(),
      },
    },
    async (args: SearchParams) => {
      try {
        return ok(await searchWorkspace(supabaseAdmin as never, ctx.workspaceId, args))
      } catch (e) {
        return fail(`search failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    },
  )
}
