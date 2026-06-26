import { randomBytes } from 'node:crypto'

export interface RegisteredClient {
  clientId: string
  clientName: string
  redirectUris: string[]
  tokenEndpointAuthMethod: 'none'
  createdAt: string
}

interface ClientRow {
  client_id: string
  client_name: string
  redirect_uris: string[]
  token_endpoint_auth_method: string
  created_at: string
}

export interface OAuthClientsDb {
  from(table: 'oauth_clients'): {
    insert(row: Record<string, unknown>): { select(cols: string): { single(): Promise<{ data: ClientRow | null; error: { message: string } | null }> } }
    select(cols: string): { eq(col: string, val: string): { maybeSingle(): Promise<{ data: ClientRow | null; error: { message: string } | null }> } }
  }
}

function mapRow(row: ClientRow): RegisteredClient {
  return {
    clientId: row.client_id,
    clientName: row.client_name,
    redirectUris: row.redirect_uris ?? [],
    tokenEndpointAuthMethod: 'none',
    createdAt: row.created_at,
  }
}

export async function registerClient(
  db: OAuthClientsDb,
  input: { clientName: string; redirectUris: string[] },
): Promise<RegisteredClient> {
  if (input.clientName.length > 200) throw new Error('client_name too long')
  if (!input.redirectUris.length) throw new Error('redirect_uris must not be empty')
  if (input.redirectUris.length > 10) throw new Error('too many redirect_uris')
  for (const uri of input.redirectUris) {
    let url: URL
    try { url = new URL(uri) } catch { throw new Error(`invalid redirect_uri: ${uri}`) }
    const dangerousSchemes = ['javascript:', 'data:', 'vbscript:', 'file:']
    if (dangerousSchemes.includes(url.protocol)) throw new Error(`invalid redirect_uri scheme: ${uri}`)
    if (url.protocol === 'http:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      throw new Error(`invalid redirect_uri scheme: ${uri}`)
    }
  }
  const clientId = `lynq_client_${randomBytes(16).toString('base64url')}`
  const row = {
    client_id: clientId,
    client_name: input.clientName || 'MCP Client',
    redirect_uris: input.redirectUris,
    token_endpoint_auth_method: 'none',
  }
  const { data, error } = await db.from('oauth_clients').insert(row).select('*').single()
  if (error || !data) throw new Error(`registerClient failed: ${error?.message ?? 'no row'}`)
  return mapRow(data)
}

export async function getClient(db: OAuthClientsDb, clientId: string): Promise<RegisteredClient | null> {
  const { data, error } = await db.from('oauth_clients').select('*').eq('client_id', clientId).maybeSingle()
  if (error || !data) return null
  return mapRow(data)
}
