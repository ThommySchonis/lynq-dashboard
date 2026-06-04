import { Hono } from 'hono'
import { logger } from '../lib/logger.ts'
import { withIdempotency } from '../lib/services/webhook-idempotency.ts'
import { handleEmailWebhook } from '../lib/services/webhook-handlers.ts'

// ─── Crypto helpers ───────────────────────────────────────────────────

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

function getWebhookSecretBytes(secret: string): Uint8Array {
  if (secret.startsWith('whsec_')) {
    const b64 = secret.slice(6)
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  }
  return new TextEncoder().encode(secret)
}

async function hmacSha256Base64(keyBytes: Uint8Array, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  const bytes = new Uint8Array(sig)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

async function hmacSha256Hex(keyBytes: Uint8Array, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function verifySvixSignature(
  request: Request,
  rawBody: string,
  secret: string
): Promise<boolean> {
  const id = request.headers.get('svix-id')
  const timestamp = request.headers.get('svix-timestamp')
  const signatures = request.headers.get('svix-signature')
  if (!id || !timestamp || !signatures) return false

  const signedPayload = `${id}.${timestamp}.${rawBody}`
  const keyBytes = getWebhookSecretBytes(secret)
  const expected = await hmacSha256Base64(keyBytes, signedPayload)

  return signatures
    .split(' ')
    .some((s) => constantTimeEqual(s.replace(/^v\d+,/, ''), expected))
}

async function verifyInboundSecret(request: Request, rawBody: string): Promise<boolean> {
  const secret = Deno.env.get('EMAIL_WEBHOOK_SECRET')
  if (!secret) return false

  // Method 1: x-webhook-secret header (plain secret comparison)
  const providedSecret = request.headers.get('x-webhook-secret')
  if (providedSecret && constantTimeEqual(providedSecret, secret)) return true

  // Method 2: x-webhook-signature header (HMAC hex)
  const signature = request.headers.get('x-webhook-signature')
  if (signature) {
    const keyBytes = new TextEncoder().encode(secret)
    const expected = await hmacSha256Hex(keyBytes, rawBody)
    if (constantTimeEqual(signature.replace(/^sha256=/, ''), expected)) return true
  }

  // Method 3: Svix signature
  return verifySvixSignature(request, rawBody, secret)
}

// ─── Routes ───────────────────────────────────────────────────────────

export const webhooksEmailRoutes = new Hono()

webhooksEmailRoutes.post('/', async (c) => {
  const rawBody = await c.req.text()
  if (!(await verifyInboundSecret(c.req.raw, rawBody))) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const svixId = c.req.header('svix-id') ?? null

  return withIdempotency({
    rawBody,
    request: c.req.raw,
    source: 'email',
    eventType: 'inbound',
    extractEventId: () => svixId,
    handler: async (body) => {
      const result = await handleEmailWebhook(body as Record<string, unknown>)
      return {
        response: new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
        workspaceId: result.workspaceId,
      }
    },
  })
})
