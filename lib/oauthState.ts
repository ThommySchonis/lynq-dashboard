import crypto from 'crypto'

const STATE_TTL_MS = 15 * 60 * 1000

function getStateSecret() {
  return process.env.OAUTH_STATE_SECRET || process.env.SUPABASE_SECRET_KEY
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString('base64url')
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function signPayload(payload: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url')
}

interface OAuthStatePayload {
  userId: string
  workspaceId: string
  provider: string
  storeId?: string | null
  exp: number
  nonce: string
}

export function createOAuthState({ userId, workspaceId, provider, storeId }: { userId: string; workspaceId: string; provider: string; storeId?: string }) {
  const secret = getStateSecret()
  if (!secret) throw new Error('OAuth state secret is not configured')

  const payload = base64UrlEncode(JSON.stringify({
    userId,
    workspaceId,
    provider,
    storeId: storeId || null,
    exp: Date.now() + STATE_TTL_MS,
    nonce: crypto.randomBytes(16).toString('hex'),
  }))
  const signature = signPayload(payload, secret)

  return `${payload}.${signature}`
}

export function verifyOAuthState(state: string | null | undefined, expectedProvider: string): OAuthStatePayload | null {
  const secret = getStateSecret()
  if (!secret || !state) return null

  const [payload, signature] = state.split('.')
  if (!payload || !signature) return null

  const expectedSignature = signPayload(payload, secret)
  const provided = Buffer.from(signature)
  const expected = Buffer.from(expectedSignature)
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return null
  }

  try {
    const data = JSON.parse(base64UrlDecode(payload)) as OAuthStatePayload
    if (data.provider !== expectedProvider) return null
    if (!data.userId || !data.exp || Date.now() > data.exp) return null
    // workspaceId is optional for backwards-compat but will be present for new flows
    return {
      ...data,
      storeId: data.storeId || null,
    }
  } catch {
    return null
  }
}
