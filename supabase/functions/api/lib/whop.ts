import { resilientFetch } from './resilient-fetch.ts'
import { logger } from './logger.ts'

const WHOP_API_URL = Deno.env.get('WHOP_API_URL') ?? 'https://api.whop.com/api/v1'
const WHOP_API_KEY = Deno.env.get('WHOP_API_KEY')

if (!WHOP_API_KEY) {
  logger.warn('[whop]', 'WHOP_API_KEY not set — all calls will fail')
}

interface WhopErrorPayload {
  error?: { message?: string; code?: string }
}

export class WhopApiError extends Error {
  status:     number
  whopCode:   string | null
  endpoint:   string
  body:       unknown

  constructor(message: string, opts: { status: number; whopCode?: string | null; endpoint: string; body?: unknown }) {
    super(message)
    this.name     = 'WhopApiError'
    this.status   = opts.status
    this.whopCode = opts.whopCode ?? null
    this.endpoint = opts.endpoint
    this.body     = opts.body
  }
}

function asciiSafe(value: string): string {
  return value
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[  ]/g, ' ')
    .replace(/[^\x20-\x7E]/g, '')
}

interface WhopFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?:   unknown
  idempotencyKey?: string
}

async function whopFetch<T>(path: string, options: WhopFetchOptions = {}): Promise<T> {
  if (!WHOP_API_KEY) {
    throw new WhopApiError('WHOP_API_KEY not configured', { status: 500, endpoint: path })
  }

  const url = `${WHOP_API_URL.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`
  const headers: Record<string, string> = {
    'Authorization': asciiSafe(`Bearer ${WHOP_API_KEY}`),
    'Accept':        'application/json',
  }
  if (options.body) headers['Content-Type'] = 'application/json'
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = asciiSafe(options.idempotencyKey)
  }

  const result = await resilientFetch<T>(
    'whop',
    url,
    {
      method:  options.method ?? 'GET',
      headers,
      body:    options.body ? JSON.stringify(options.body) : undefined,
    },
  )

  if (!result.ok) {
    let message = `Whop API error ${result.status}`
    let whopCode: string | null = null
    let parsedBody: unknown = result.error

    try {
      const parsed = JSON.parse(result.error) as WhopErrorPayload
      if (parsed?.error?.message) message = parsed.error.message
      if (parsed?.error?.code) whopCode = parsed.error.code
      parsedBody = parsed
    } catch {
      if (result.error && result.error !== `HTTP ${result.status}`) {
        message = result.error
      }
    }

    throw new WhopApiError(message, {
      status:   result.status,
      whopCode,
      endpoint: path,
      body:     parsedBody,
    })
  }

  return result.data
}

export interface WhopMembership {
  id:                   string
  user_id?:             string
  plan_id?:             string
  product_id?:          string
  status?:              'active' | 'past_due' | 'canceled' | 'paused' | 'trialing' | string
  valid?:               boolean
  cancel_at_period_end?: boolean
  current_period_start?: number | string
  current_period_end?:   number | string
  renewal_period_start?: number | string
  renewal_period_end?:   number | string
  canceled_at?:         number | string | null
  metadata?:            Record<string, unknown>
  [key: string]: unknown
}

export interface WhopCheckoutSession {
  id:           string
  purchase_url: string
  plan_id?:     string
  expires_at?:  number
  metadata?:    Record<string, unknown>
  [key: string]: unknown
}

export async function createCheckoutSession({
  whopPlanId,
  workspaceId,
  successUrl,
  metadata,
}: {
  whopPlanId:  string
  workspaceId: string
  successUrl?: string
  metadata?:   Record<string, unknown>
}): Promise<WhopCheckoutSession> {
  return await whopFetch<WhopCheckoutSession>('/checkout_configurations', {
    method: 'POST',
    body: {
      mode:         'payment',
      plan_id:      whopPlanId,
      redirect_url: successUrl,
      metadata: {
        workspace_id: workspaceId,
        ...(metadata ?? {}),
      },
    },
    idempotencyKey: `checkout-${workspaceId}-${whopPlanId}-${Date.now()}`,
  })
}

export async function updateMembership({
  membershipId,
  newPlanId,
}: {
  membershipId: string
  newPlanId:    string
}): Promise<WhopMembership> {
  return await whopFetch<WhopMembership>(`/memberships/${membershipId}`, {
    method: 'PATCH',
    body:   { plan_id: newPlanId },
  })
}

export async function cancelMembership({
  membershipId,
}: {
  membershipId: string
}): Promise<WhopMembership> {
  return await whopFetch<WhopMembership>(`/memberships/${membershipId}/cancel`, {
    method: 'POST',
  })
}

export async function uncancelMembership({
  membershipId,
}: {
  membershipId: string
}): Promise<WhopMembership> {
  return await whopFetch<WhopMembership>(`/memberships/${membershipId}/uncancel`, {
    method: 'POST',
  })
}

export async function retrieveMembership({
  membershipId,
}: {
  membershipId: string
}): Promise<WhopMembership> {
  return await whopFetch<WhopMembership>(`/memberships/${membershipId}`, { method: 'GET' })
}

export async function updateSubscription({
  subscriptionId,
  newPlanId,
}: {
  subscriptionId: string
  newPlanId: string
  prorate?: boolean
}): Promise<WhopMembership> {
  return await updateMembership({ membershipId: subscriptionId, newPlanId })
}

export async function cancelSubscription({
  subscriptionId,
  atPeriodEnd = true,
}: {
  subscriptionId: string
  atPeriodEnd?: boolean
}): Promise<WhopMembership> {
  if (!atPeriodEnd) {
    logger.warn('[whop]', 'cancelSubscription called with atPeriodEnd=false — Whop only supports period-end cancellation, falling back to soft cancel')
  }
  return await cancelMembership({ membershipId: subscriptionId })
}

export async function reactivateSubscription({
  subscriptionId,
}: {
  subscriptionId: string
}): Promise<WhopMembership> {
  return await uncancelMembership({ membershipId: subscriptionId })
}

export async function deletePaymentMethod(_input: {
  paymentMethodId: string
}): Promise<never> {
  throw new WhopApiError(
    'Payment methods are managed via Whop\'s hosted checkout.',
    { status: 501, endpoint: 'deletePaymentMethod (deprecated)' },
  )
}

// Web Crypto HMAC-SHA256 webhook verification
export async function verifyWebhookSignature({
  webhookId,
  webhookTimestamp,
  webhookSignature,
  rawBody,
  secret,
}: {
  webhookId:        string | null
  webhookTimestamp: string | null
  webhookSignature: string | null
  rawBody:          string
  secret:           string | undefined
}): Promise<boolean> {
  if (!secret || !webhookId || !webhookTimestamp || !webhookSignature) return false

  const secretCore = secret.startsWith('whsec_') ? secret.slice(6) : secret

  let secretBytes: Uint8Array
  try {
    const decoded = atob(secretCore)
    secretBytes = new Uint8Array(decoded.length)
    for (let i = 0; i < decoded.length; i++) {
      secretBytes[i] = decoded.charCodeAt(i)
    }
    if (secretBytes.length === 0) secretBytes = new TextEncoder().encode(secretCore)
  } catch {
    secretBytes = new TextEncoder().encode(secretCore)
  }

  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent))
  const expectedBytes = new Uint8Array(signatureBuffer)

  // Convert to base64
  let expected = ''
  for (const b of expectedBytes) expected += String.fromCharCode(b)
  expected = btoa(expected)

  return webhookSignature
    .split(' ')
    .some(token => {
      const sigPart = token.trim().replace(/^v\d+,/, '')
      if (sigPart.length !== expected.length) return false
      // Constant-time comparison
      let mismatch = 0
      for (let i = 0; i < sigPart.length; i++) {
        mismatch |= sigPart.charCodeAt(i) ^ expected.charCodeAt(i)
      }
      return mismatch === 0
    })
}
