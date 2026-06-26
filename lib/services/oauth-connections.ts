export interface ConnectedApp { clientId: string; clientName: string; connectedAt: string; lastUsedAt: string | null }

interface TokenRow { client_id: string; created_at: string; last_used_at: string | null }
interface ClientRow { client_id: string; client_name: string }

interface ConnTokensQuery {
  select(cols: string): { eq(c: string, v: string): { is(c: string, v: null): Promise<{ data: TokenRow[] | null; error: { message: string } | null }> } }
  update(row: Record<string, unknown>): {
    eq(c: string, v: string): ConnUpdateChain
  }
}
interface ConnUpdateChain {
  eq(c: string, v: string): ConnUpdateChain
  is(c: string, v: null): ConnUpdateChain
  select(): Promise<{ data: { id: string }[] | null; error: { message: string } | null }>
}
interface ConnClientsQuery { select(cols: string): { in(c: string, v: string[]): Promise<{ data: ClientRow[] | null; error: { message: string } | null }> } }
export interface ConnectionsDb {
  from(table: 'oauth_tokens'): ConnTokensQuery
  from(table: 'oauth_clients'): ConnClientsQuery
}

export async function listUserConnections(db: ConnectionsDb, userId: string): Promise<ConnectedApp[]> {
  const tokensRes = await db.from('oauth_tokens').select('client_id, created_at, last_used_at').eq('user_id', userId).is('revoked_at', null)
  if (tokensRes.error) throw new Error(`listUserConnections failed: ${tokensRes.error.message}`)
  const rows = tokensRes.data ?? []
  if (rows.length === 0) return []

  const clientIds = [...new Set(rows.map((r) => r.client_id))]
  const clientsRes = await db.from('oauth_clients').select('client_id, client_name').in('client_id', clientIds)
  const names = new Map((clientsRes.data ?? []).map((c) => [c.client_id, c.client_name]))

  const byClient = new Map<string, ConnectedApp>()
  for (const r of rows) {
    const existing = byClient.get(r.client_id)
    if (!existing) {
      byClient.set(r.client_id, { clientId: r.client_id, clientName: names.get(r.client_id) ?? 'Unknown app', connectedAt: r.created_at, lastUsedAt: r.last_used_at })
    } else {
      if (r.created_at < existing.connectedAt) existing.connectedAt = r.created_at
      if (r.last_used_at && (!existing.lastUsedAt || r.last_used_at > existing.lastUsedAt)) existing.lastUsedAt = r.last_used_at
    }
  }
  return [...byClient.values()]
}

export async function revokeUserConnection(db: ConnectionsDb, userId: string, clientId: string): Promise<number> {
  const { data, error } = await db
    .from('oauth_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('client_id', clientId)
    .is('revoked_at', null)
    .select()
  if (error) throw new Error(`revokeUserConnection failed: ${error.message}`)
  return (data ?? []).length
}
