import { hashToken } from '@/lib/services/oauth-tokens'
import { generateAuthCode } from '@/lib/oauth/pkce'

const CODE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export interface AuthCodeRecord {
  clientId: string
  userId: string
  workspaceId: string
  redirectUri: string
  codeChallenge: string
  scope: string | null
}

interface CodeRow {
  client_id: string
  user_id: string
  workspace_id: string
  redirect_uri: string
  code_challenge: string
  scope: string | null
  expires_at: string
}

export interface OAuthCodesDb {
  from(table: 'oauth_authorization_codes'): {
    insert(row: Record<string, unknown>): Promise<{ error: { message: string } | null }>
    select(cols: string): { eq(col: string, val: string): { maybeSingle(): Promise<{ data: CodeRow | null; error: { message: string } | null }> } }
    delete(): { eq(col: string, val: string): Promise<{ error: { message: string } | null }> }
  }
}

export async function createAuthCode(db: OAuthCodesDb, data: AuthCodeRecord): Promise<string> {
  const code = generateAuthCode()
  const { error } = await db.from('oauth_authorization_codes').insert({
    code_hash: hashToken(code),
    client_id: data.clientId,
    user_id: data.userId,
    workspace_id: data.workspaceId,
    redirect_uri: data.redirectUri,
    code_challenge: data.codeChallenge,
    code_challenge_method: 'S256',
    scope: data.scope,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  })
  if (error) throw new Error(`createAuthCode failed: ${error.message}`)
  return code
}

export async function consumeAuthCode(db: OAuthCodesDb, rawCode: string): Promise<AuthCodeRecord | null> {
  if (!rawCode.startsWith('lynq_ac_')) return null
  const codeHash = hashToken(rawCode)
  const { data, error } = await db
    .from('oauth_authorization_codes')
    .select('client_id, user_id, workspace_id, redirect_uri, code_challenge, scope, expires_at')
    .eq('code_hash', codeHash)
    .maybeSingle()

  if (error || !data) return null
  // Single-use: always delete the row once located, before validating expiry.
  await db.from('oauth_authorization_codes').delete().eq('code_hash', codeHash)
  if (new Date(data.expires_at).getTime() <= Date.now()) return null

  return {
    clientId: data.client_id,
    userId: data.user_id,
    workspaceId: data.workspace_id,
    redirectUri: data.redirect_uri,
    codeChallenge: data.code_challenge,
    scope: data.scope,
  }
}
