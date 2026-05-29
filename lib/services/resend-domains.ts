import type { DnsRecord } from '@/types/forwarding'

interface ResendDomain {
  id: string
  name: string
  status: string
  records: DnsRecord[]
}

async function getResend() {
  const { Resend } = await import('resend')
  return new Resend(process.env.RESEND_API_KEY)
}

export async function findDomainByName(domainName: string): Promise<ResendDomain | null> {
  const resend = await getResend()
  const { data, error } = await resend.domains.list()
  if (error || !data) return null
  const domains = (data as unknown as { data: ResendDomain[] }).data ?? (data as unknown as ResendDomain[])
  const match = (Array.isArray(domains) ? domains : []).find(
    (d: ResendDomain) => d.name === domainName
  )
  return (match as ResendDomain) ?? null
}

export async function registerOrGetDomain(domainName: string): Promise<ResendDomain> {
  const resend = await getResend()
  const { data, error } = await resend.domains.create({ name: domainName })
  if (data) return data as unknown as ResendDomain

  // Domain already exists in Resend — look it up
  if (error?.message?.includes('already')) {
    const existing = await findDomainByName(domainName)
    if (existing) return existing
  }

  throw new Error(`Failed to register domain: ${error?.message ?? 'Unknown error'}`)
}

export async function getDomain(domainId: string): Promise<ResendDomain> {
  const resend = await getResend()
  const { data, error } = await resend.domains.get(domainId)
  if (error) throw new Error(`Failed to get domain: ${error.message}`)
  return data as unknown as ResendDomain
}

export async function verifyDomain(domainId: string): Promise<void> {
  const resend = await getResend()
  const { error } = await resend.domains.verify(domainId)
  if (error) throw new Error(`Failed to verify domain: ${error.message}`)
}

export async function deleteDomain(domainId: string): Promise<void> {
  const resend = await getResend()
  const { error } = await resend.domains.remove(domainId)
  if (error) throw new Error(`Failed to delete domain: ${error.message}`)
}

export function isDomainVerified(domain: ResendDomain): boolean {
  return domain.status === 'verified'
}

export function getDnsRecords(domain: ResendDomain): DnsRecord[] {
  return domain.records || []
}
