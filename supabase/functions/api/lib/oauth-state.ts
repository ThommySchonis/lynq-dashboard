const STATE_TTL_MS = 15 * 60 * 1000

function getStateSecret(): string | undefined {
  return Deno.env.get('OAUTH_STATE_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): string {
  let s = str.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return atob(s)
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const bytes = new Uint8Array(sig)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

interface OAuthStatePayload {
  userId: string
  workspaceId: string
  provider: string
  storeId?: string | null
  exp: number
  nonce: string
}

export async function createOAuthState({
  userId,
  workspaceId,
  provider,
  storeId,
}: {
  userId: string
  workspaceId: string
  provider: string
  storeId?: string
}): Promise<string> {
  const secret = getStateSecret()
  if (!secret) throw new Error('OAuth state secret is not configured')

  const payload = base64UrlEncode(
    JSON.stringify({
      userId,
      workspaceId,
      provider,
      storeId: storeId || null,
      exp: Date.now() + STATE_TTL_MS,
      nonce: crypto.randomUUID(),
    }),
  )
  const signature = await signPayload(payload, secret)

  return `${payload}.${signature}`
}

export async function verifyOAuthState(
  state: string | null | undefined,
  expectedProvider: string,
): Promise<OAuthStatePayload | null> {
  const secret = getStateSecret()
  if (!secret || !state) return null

  const [payload, signature] = state.split('.')
  if (!payload || !signature) return null

  const expectedSignature = await signPayload(payload, secret)
  if (!constantTimeEqual(signature, expectedSignature)) {
    return null
  }

  try {
    const data = JSON.parse(base64UrlDecode(payload)) as OAuthStatePayload
    if (data.provider !== expectedProvider) return null
    if (!data.userId || !data.exp || Date.now() > data.exp) return null
    return {
      ...data,
      storeId: data.storeId || null,
    }
  } catch {
    return null
  }
}
