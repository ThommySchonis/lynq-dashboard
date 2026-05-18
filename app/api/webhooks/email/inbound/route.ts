import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { processInboundMessage } from '../../../../../lib/conversationEngine'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import crypto from 'crypto'

interface EmailFromObj {
  email?: string
  name?: string
}

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

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Resend sends parsed email fields
  const to = (payload.to as Array<{ email: string }> | undefined)?.[0]?.email || payload.to as string | undefined
  const fromObj = payload.from as EmailFromObj | string | undefined
  const fromEmail = typeof fromObj === 'object' && fromObj?.email ? fromObj.email : fromObj as string | undefined
  const fromName = (typeof fromObj === 'object' && fromObj?.name ? fromObj.name : fromEmail) as string | undefined
  const subject = (payload.subject as string | undefined) || '(no subject)'
  const bodyHtml = (payload.html as string | undefined) || (payload.text as string | undefined) || ''
  const bodyText = (payload.text as string | undefined) || ''
  const headers = payload.headers as Record<string, string> | undefined
  const messageId = headers?.['message-id'] || payload.message_id as string | undefined
  const inReplyTo = headers?.['in-reply-to'] || payload.in_reply_to as string | undefined

  if (!to) return NextResponse.json({ ok: true })

  // Look up email account by forwarding address
  const accountResult = await supabaseAdmin
    .from('email_accounts')
    .select('*')
    .eq('forwarding_address', to)
    .maybeSingle()

  const account = accountResult.data as Parameters<typeof processInboundMessage>[0] | null
  if (!account) return NextResponse.json({ ok: true })

  // Normalize the inbound email into a NormalizedMessage shape
  const normalizedMessage = {
    providerMessageId: messageId || `inbound_${Date.now()}`,
    messageId: inReplyTo || messageId || undefined,
    from: { email: fromEmail ?? '', name: fromName },
    to: [{ email: to, name: '' }],
    cc: [],
    subject,
    bodyHtml,
    bodyText,
    date: new Date().toISOString(),
    isOutbound: false,
  }

  await processInboundMessage(account, normalizedMessage)

  return NextResponse.json({ ok: true })
}
