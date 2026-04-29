import crypto from 'crypto'

const STATE_TTL_MS = 15 * 60 * 1000

function getStateSecret() {
  return process.env.OAUTH_STATE_SECRET || process.env.SUPABASE_SECRET_KEY
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url')
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function signPayload(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url')
}

export function createOAuthState({ userId, provider }) {
  const secret = getStateSecret()
  if (!secret) throw new Error('OAuth state secret is not configured')

  const payload = base64UrlEncode(JSON.stringify({
    userId,
    provider,
    exp: Date.now() + STATE_TTL_MS,
    nonce: crypto.randomBytes(16).toString('hex'),
  }))
  const signature = signPayload(payload, secret)

  return `${payload}.${signature}`
}

export function verifyOAuthState(state, expectedProvider) {
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
    const data = JSON.parse(base64UrlDecode(payload))
    if (data.provider !== expectedProvider) return null
    if (!data.userId || !data.exp || Date.now() > data.exp) return null
    return data
  } catch {
    return null
  }
}
