import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { buildReplyContext } from '@/lib/services/mcp-reply-context'
import { ok, fail } from '@/mcp/tools/inbox'
import type { McpToolContext } from '@/mcp/types'

export function registerContextTools(server: McpServer, ctx: McpToolContext): void {
  server.registerTool(
    'get_reply_context',
    {
      description:
        'Get everything needed to compose an on-brand, policy-aware reply for a conversation in ONE call: the message thread, linked Shopify order context, the assembled AI/Emma system prompt + brand policies + scenarios + lessons + examples, the best-matching reply templates (macros) ranked by relevance, and the workspace autonomy snapshot (what may auto-send vs must be drafted/escalated). Call this before send_reply.',
      inputSchema: { conversationId: z.string(), storeId: z.string().optional() },
    },
    async (args: { conversationId: string; storeId?: string }) => {
      try {
        const context = await buildReplyContext({
          workspaceId: ctx.workspaceId,
          conversationId: args.conversationId,
          storeId: args.storeId,
        })
        if (!context) return fail(`Conversation ${args.conversationId} not found in this workspace.`)
        return ok(context)
      } catch (e) {
        return fail(`get_reply_context failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    },
  )
}
