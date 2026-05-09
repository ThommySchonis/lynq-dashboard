import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { processInboundMessage } from '../../../../../lib/conversationEngine'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

function timingSafeCompare(a, b) {
  const left = Buffer.from(a || '')
  const right = Buffer.from(b || '')
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

function getWebhookSecretBytes(secret) {
  if (secret.startsWith('whsec_')) return Buffer.from(secret.slice(6), 'base64')
  return Buffer.from(secret)
}

function verifySvixSignature(request, rawBody, secret) {
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

function verifyInboundSecret(request, rawBody) {
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

export async function POST(request) {
  const rawBody = await request.text()
  if (!verifyInboundSecret(request, rawBody)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Resend sends parsed email fields
  const to = payload.to?.[0]?.email || payload.to
  const fromEmail = payload.from?.email || payload.from
  const fromName = payload.from?.name || fromEmail
  const subject = payload.subject || '(no subject)'
  const bodyHtml = payload.html || payload.text || ''
  const bodyText = payload.text || ''
  const messageId = payload.headers?.['message-id'] || payload.message_id
  const inReplyTo = payload.headers?.['in-reply-to'] || payload.in_reply_to

  if (!to) return NextResponse.json({ ok: true })

  // Look up email account by forwarding address
  const { data: account } = await supabaseAdmin
    .from('email_accounts')
    .select('*')
    .eq('forwarding_address', to)
    .maybeSingle()

  if (!account) return NextResponse.json({ ok: true })

  // Normalize the inbound email into a NormalizedMessage shape
  const normalizedMessage = {
    providerMessageId: messageId || `inbound_${Date.now()}`,
    messageId: inReplyTo || messageId || null,
    from: { email: fromEmail, name: fromName },
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
