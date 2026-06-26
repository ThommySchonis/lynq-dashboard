import { protectedResourceHandler, metadataCorsOptionsRequestHandler } from 'mcp-handler'

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728).
 *
 * Declares that this resource is protected and points MCP clients to the
 * authorization server that issues tokens for it. The authorization server
 * endpoints (Phase 2) live at the same origin.
 */
const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.lynq.app'

const handler = protectedResourceHandler({
  authServerUrls: [base],
  resourceUrl: `${base}/api/v1/mcp`,
})

export { handler as GET }
export const OPTIONS = metadataCorsOptionsRequestHandler()
