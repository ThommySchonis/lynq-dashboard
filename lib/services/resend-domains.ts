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

export async function registerDomain(domainName: string): Promise<ResendDomain> {
  const resend = await getResend()
  const { data, error } = await resend.domains.create({ name: domainName })
  if (error) throw new Error(`Failed to register domain: ${error.message}`)
  return data as unknown as ResendDomain
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
