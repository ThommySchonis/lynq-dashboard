import { createHash, randomBytes } from 'node:crypto'

const ACCESS_TTL_MS = 60 * 60 * 1000          // 1 hour
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export interface IssuedTokenPair {
  accessToken: string
  refreshToken: string
  accessExpiresAt: string
  refreshExpiresAt: string
  tokenId: string
}

export interface VerifiedToken {
  tokenId: string
  clientId: string
  userId: string
  workspaceId: string
  scope: string | null
}

interface TokenRow {
  id: string
  client_id: string
  user_id: string
  workspace_id: string
  scope: string | null
  access_expires_at: string
  revoked_at: string | null
}

/** Minimal supabase surface these functions use — injected for testability. */
export interface TokenStoreDb {
  from(table: 'oauth_tokens'): {
    insert(row: Record<string, unknown>): { select(cols: string): { single(): Promise<{ data: { id: string } | null; error: { message: string } | null }> } }
    select(cols: string): {
      eq(col: string, val: string): {
        is(col: string, val: null): { maybeSingle(): Promise<{ data: TokenRow | null; error: { message: string } | null }> }
        maybeSingle(): Promise<{ data: TokenRow | null; error: { message: string } | null }>
      }
      or(condition: string): { maybeSingle(): Promise<{ data: { id: string } | null; error: { message: string } | null }> }
    }
    update(row: Record<string, unknown>): { eq(col: string, val: string): Promise<{ error: { message: string } | null }> }
  }
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export function generateOpaqueToken(prefix: 'lynq_at' | 'lynq_rt'): string {
  return `${prefix}_${randomBytes(32).toString('base64url')}`
}

export async function createTokenPair(
  db: TokenStoreDb,
  args: { clientId: string; userId: string; workspaceId: string; scope?: string | null },
): Promise<IssuedTokenPair> {
  const accessToken = generateOpaqueToken('lynq_at')
  const refreshToken = generateOpaqueToken('lynq_rt')
  const now = Date.now()
  const accessExpiresAt = new Date(now + ACCESS_TTL_MS).toISOString()
  const refreshExpiresAt = new Date(now + REFRESH_TTL_MS).toISOString()

  const { data, error } = await db
    .from('oauth_tokens')
    .insert({
      client_id: args.clientId,
      user_id: args.userId,
      workspace_id: args.workspaceId,
      access_token_hash: hashToken(accessToken),
      refresh_token_hash: hashToken(refreshToken),
      scope: args.scope ?? null,
      access_expires_at: accessExpiresAt,
      refresh_expires_at: refreshExpiresAt,
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(`createTokenPair failed: ${error?.message ?? 'no row'}`)
  return { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt, tokenId: data.id }
}

export async function verifyAccessToken(db: TokenStoreDb, raw: string): Promise<VerifiedToken | null> {
  if (!raw.startsWith('lynq_at_')) return null
  const { data, error } = await db
    .from('oauth_tokens')
    .select('id, client_id, user_id, workspace_id, scope, access_expires_at, revoked_at')
    .eq('access_token_hash', hashToken(raw))
    .maybeSingle()

  if (error || !data) return null
  if (data.revoked_at) return null
  if (new Date(data.access_expires_at).getTime() <= Date.now()) return null

  // Best-effort last_used_at bump (non-fatal).
  await db.from('oauth_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', data.id)

  return {
    tokenId: data.id,
    clientId: data.client_id,
    userId: data.user_id,
    workspaceId: data.workspace_id,
    scope: data.scope,
  }
}

export async function revokeToken(db: TokenStoreDb, tokenId: string): Promise<void> {
  const { error } = await db
    .from('oauth_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId)
  if (error) throw new Error(`revokeToken failed: ${error.message}`)
}

interface RefreshRow {
  id: string
  client_id: string
  user_id: string
  workspace_id: string
  scope: string | null
  revoked_at: string | null
  refresh_expires_at: string | null
}

export async function rotateRefreshToken(
  db: TokenStoreDb,
  rawRefresh: string,
): Promise<IssuedTokenPair | null> {
  if (!rawRefresh.startsWith('lynq_rt_')) return null

  const { data, error } = await db
    .from('oauth_tokens')
    .select('id, client_id, user_id, workspace_id, scope, revoked_at, refresh_expires_at')
    .eq('refresh_token_hash', hashToken(rawRefresh))
    .maybeSingle()

  const row = data as RefreshRow | null
  if (error || !row) return null
  if (row.revoked_at) return null
  if (!row.refresh_expires_at || new Date(row.refresh_expires_at).getTime() <= Date.now()) return null

  // Rotation: revoke the old token row, then issue a fresh pair.
  const revoke = await db.from('oauth_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', row.id)
  if (revoke.error) return null

  return createTokenPair(db, {
    clientId: row.client_id,
    userId: row.user_id,
    workspaceId: row.workspace_id,
    scope: row.scope,
  })
}

export async function revokeByRawToken(db: TokenStoreDb, rawToken: string): Promise<void> {
  const h = hashToken(rawToken)
  const { data } = await db
    .from('oauth_tokens')
    .select('id')
    .or(`access_token_hash.eq.${h},refresh_token_hash.eq.${h}`)
    .maybeSingle()
  const row = data as { id: string } | null
  if (!row) return // RFC 7009: unknown token → success, no-op
  await db.from('oauth_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', row.id)
}
