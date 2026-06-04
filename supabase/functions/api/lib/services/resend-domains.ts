import { logger } from '../logger.ts'

const RESEND_API_BASE = 'https://api.resend.com'

interface ResendDomain {
  id: string
  name: string
  status: string
  records: Array<{
    type: string
    name: string
    value: string
    status: string
    ttl: string
    priority?: number
  }>
}

function getApiKey(): string {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) throw new Error('RESEND_API_KEY is not configured')
  return key
}

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    'Content-Type': 'application/json',
  }
}

export async function findDomainByName(domainName: string): Promise<ResendDomain | null> {
  const res = await fetch(`${RESEND_API_BASE}/domains`, {
    method: 'GET',
    headers: headers(),
  })

  if (!res.ok) {
    logger.error('[resend-domains]', 'Failed to list domains', { status: res.status })
    return null
  }

  const body = await res.json()
  const domains: ResendDomain[] = body.data ?? body ?? []

  if (!Array.isArray(domains)) return null

  const match = domains.find((d: ResendDomain) => d.name === domainName)
  return match ?? null
}

export async function registerOrGetDomain(domainName: string): Promise<ResendDomain> {
  const res = await fetch(`${RESEND_API_BASE}/domains`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ name: domainName }),
  })

  if (res.ok) {
    return (await res.json()) as ResendDomain
  }

  const errorBody = await res.json().catch(() => ({}))
  const errorMessage = (errorBody as Record<string, string>).message ?? ''

  // Domain already exists in Resend — look it up
  if (errorMessage.includes('already')) {
    const existing = await findDomainByName(domainName)
    if (existing) return existing
  }

  throw new Error(`Failed to register domain: ${errorMessage || `HTTP ${res.status}`}`)
}

export async function getDomain(domainId: string): Promise<ResendDomain> {
  const res = await fetch(`${RESEND_API_BASE}/domains/${domainId}`, {
    method: 'GET',
    headers: headers(),
  })

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    throw new Error(`Failed to get domain: ${(errorBody as Record<string, string>).message ?? `HTTP ${res.status}`}`)
  }

  return (await res.json()) as ResendDomain
}

export async function verifyDomain(domainId: string): Promise<void> {
  const res = await fetch(`${RESEND_API_BASE}/domains/${domainId}/verify`, {
    method: 'POST',
    headers: headers(),
  })

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    throw new Error(`Failed to verify domain: ${(errorBody as Record<string, string>).message ?? `HTTP ${res.status}`}`)
  }
}

export async function deleteDomain(domainId: string): Promise<void> {
  const res = await fetch(`${RESEND_API_BASE}/domains/${domainId}`, {
    method: 'DELETE',
    headers: headers(),
  })

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    throw new Error(`Failed to delete domain: ${(errorBody as Record<string, string>).message ?? `HTTP ${res.status}`}`)
  }
}

export function isDomainVerified(domain: ResendDomain): boolean {
  return domain.status === 'verified'
}

export function getDnsRecords(
  domain: ResendDomain,
): Array<{ type: string; name: string; value: string; status: string; ttl: string; priority?: number }> {
  return domain.records || []
}
