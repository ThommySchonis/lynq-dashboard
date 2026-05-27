import { withIdempotency } from '@/lib/services/webhookIdempotency'
import { handleEmailWebhook } from '@/lib/services/webhookHandlers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import crypto from 'crypto'

function timingSafeCompare(a: string, b: string): boolean {
  const left = Buffer.from(a || '')
  const right = Buffer.from(b || '')
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

function getWebhookSecretBytes(secret: string): Buffer {
  if (secret.startsWith('whsec_')) return Buffer.from(secret.slice(6), 'base64')
  return Buffer.from(secret)
}

function verifySvixSignature(request: NextRequest, rawBody: string, secret: string): boolean {
  const id = request.headers.get('svix-id')
  const timestamp = request.headers.get('svix-timestamp')
  const signatures = request.headers.get('svix-signature')
  if (!id || !timestamp || !signatures) return false

  const signedPayload = `${id}.${timestamp}.${rawBody}`
  const expected = crypto
    .createHmac('sha256', getWebhookSecretBytes(secret))
    .update(signedPayload)
    .digest('base64')

  return signatures
    .split(' ')
    .some(signature => timingSafeCompare(signature.replace(/^v\d+,/, ''), expected))
}

function verifyInboundSecret(request: NextRequest, rawBody: string): boolean {
  const secret = process.env.EMAIL_WEBHOOK_SECRET
  if (!secret) return false

  const providedSecret = request.headers.get('x-webhook-secret')
  if (providedSecret && timingSafeCompare(providedSecret, secret)) return true

  const signature = request.headers.get('x-webhook-signature')
  if (signature) {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
    if (timingSafeCompare(signature.replace(/^sha256=/, ''), expected)) return true
  }

  return verifySvixSignature(request, rawBody, secret)
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  if (!verifyInboundSecret(request, rawBody)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svixId = request.headers.get('svix-id')

  return withIdempotency({
    rawBody,
    request,
    source: 'email',
    eventType: 'inbound',
    extractEventId: () => svixId,
    handler: async (body) => {
      const result = await handleEmailWebhook(body as Record<string, unknown>)
      return {
        response: NextResponse.json({ ok: true }),
        workspaceId: result.workspaceId,
      }
    },
  })
}
