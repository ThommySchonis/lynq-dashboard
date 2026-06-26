import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { registerLynqTools } from '@/mcp/server'
import { LYNQ_MCP_INSTRUCTIONS } from '@/mcp/instructions'
import { verifyMcpAccessToken } from '@/lib/services/mcp-auth'

interface LynqMcpExtra {
  userId: string
  workspaceId: string
  role: string
}

/**
 * Authenticated MCP handler for Lynq tools.
 *
 * Per request:
 *  1. withMcpAuth extracts the bearer token and calls verifyToken.
 *  2. verifyToken resolves the token to an AuthContext via verifyMcpAccessToken.
 *  3. On success it returns an AuthInfo whose `extra` carries { userId, workspaceId, role }.
 *  4. withMcpAuth sets req.auth and calls the inner handler.
 *  5. The inner handler builds a per-request createMcpHandler whose factory closes over the
 *     auth info, registers tools bound to that workspace context, and delegates to the
 *     resulting handler.
 *
 * On auth failure withMcpAuth returns HTTP 401 before the inner handler is invoked.
 */
const authedHandler = withMcpAuth(
  async (req: Request): Promise<Response> => {
    const auth = req.auth
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const extra = auth.extra as LynqMcpExtra | undefined
    if (!extra?.userId || !extra?.workspaceId || !extra?.role) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const ctx = {
      userId: extra.userId,
      workspaceId: extra.workspaceId,
      role: extra.role,
    }

    // Create a per-request handler so the factory closes over ctx.
    const requestHandler = createMcpHandler(
      (server) => {
        registerLynqTools(server, ctx)
      },
      { serverInfo: { name: 'lynq-flow', version: '1.0.0' }, instructions: LYNQ_MCP_INSTRUCTIONS },
      { basePath: '/api/v1' },
    )

    return requestHandler(req)
  },
  async (_req: Request, bearer: string | undefined): Promise<AuthInfo | undefined> => {
    if (!bearer) return undefined
    const authContext = await verifyMcpAccessToken(bearer)
    if (!authContext) return undefined
    const extra: Record<string, unknown> = {
      userId: authContext.user.id,
      workspaceId: authContext.workspaceId,
      role: authContext.role,
    }
    return {
      token: bearer,
      clientId: 'lynq-mcp',
      scopes: [],
      extra,
    }
  },
  { required: true },
)

export { authedHandler as GET, authedHandler as POST }
