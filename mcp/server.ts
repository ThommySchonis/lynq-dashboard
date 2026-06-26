import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McpToolContext } from '@/mcp/types'
import { registerInboxTools } from '@/mcp/tools/inbox'
import { registerMacroTools } from '@/mcp/tools/macros'
import { registerSearchTools } from '@/mcp/tools/search'
import { registerShopifyTools } from '@/mcp/tools/shopify'
import { registerEmmaTools } from '@/mcp/tools/emma'

export function registerLynqTools(server: McpServer, ctx: McpToolContext): void {
  registerInboxTools(server, ctx)
  registerMacroTools(server, ctx)
  registerSearchTools(server, ctx)
  registerShopifyTools(server, ctx)
  registerEmmaTools(server, ctx)
}
