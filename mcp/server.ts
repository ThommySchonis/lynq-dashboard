import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { listConversations, type ConversationFilters } from '@/lib/services/conversations'
import type { McpToolContext } from '@/mcp/types'

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

function fail(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true as const }
}

export function registerLynqTools(server: McpServer, ctx: McpToolContext): void {
  server.registerTool(
    'list_conversations',
    {
      description:
        'List inbox conversations in the workspace. Filter by status, store, email account, search text, or unlinked/spam flags.',
      inputSchema: {
        status: z.string().optional(),
        search: z.string().optional(),
        storeId: z.string().optional(),
        emailAccountId: z.string().optional(),
        unlinked: z.boolean().optional(),
        spam: z.boolean().optional(),
        page: z.number().int().min(0).optional(),
      },
    },
    async (args: ConversationFilters) => {
      try {
        const rows = await listConversations(supabaseAdmin as never, ctx.workspaceId, args)
        return ok(rows)
      } catch (e) {
        return fail(
          `list_conversations failed: ${e instanceof Error ? e.message : 'unknown error'}`,
        )
      }
    },
  )
}
