import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McpToolContext } from '@/mcp/types'
import { registerInboxTools } from '@/mcp/tools/inbox'

export function registerLynqTools(server: McpServer, ctx: McpToolContext): void {
  registerInboxTools(server, ctx)
}
