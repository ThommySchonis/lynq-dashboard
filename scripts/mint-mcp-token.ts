/**
 * Dev-only: mint an MCP access token for manual testing before the Phase 2
 * OAuth flow exists. Usage:
 *   npx tsx scripts/mint-mcp-token.ts <userId> <workspaceId>
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY in the environment.
 */
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createTokenPair } from '@/lib/services/oauth-tokens'

async function main() {
  const [userId, workspaceId] = process.argv.slice(2)
  if (!userId || !workspaceId) {
    console.error('Usage: tsx scripts/mint-mcp-token.ts <userId> <workspaceId>')
    process.exit(1)
  }
  // Ensure a dev client row exists (FK target for oauth_tokens.client_id).
  await supabaseAdmin
    .from('oauth_clients')
    .upsert({ client_id: 'lynq-mcp-dev', client_name: 'Lynq MCP Dev', redirect_uris: [] })
  const pair = await createTokenPair(supabaseAdmin as never, {
    clientId: 'lynq-mcp-dev',
    userId,
    workspaceId,
  })
  console.log('ACCESS TOKEN:\n' + pair.accessToken)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
