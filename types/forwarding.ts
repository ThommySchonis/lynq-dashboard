export interface DnsRecord {
  type: string
  name: string
  value: string
  status: string
  ttl?: string
  priority?: number
}

export interface ForwardingConnectResponse {
  account_id: string
  forwarding_address: string
  dns_records: DnsRecord[]
  domain_verified: boolean
  forwarding_verified: boolean
}

export interface ForwardingStatusResponse {
  account_id: string
  forwarding_address: string
  email: string
  domain_verified: boolean
  forwarding_verified: boolean
  dns_records: DnsRecord[]
  status: string
}

export interface ForwardingVerifyDnsResponse {
  domain_verified: boolean
  records: DnsRecord[]
}
