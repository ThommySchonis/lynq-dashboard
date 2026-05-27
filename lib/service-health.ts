import type { ServiceName, ServiceStatus } from '@/types/service-health'

interface HealthRecord {
  timestamp: number
  success: boolean
}

const WINDOW_MS = 60_000
const MIN_SAMPLES = 3

const records = new Map<ServiceName, HealthRecord[]>()

function prune(service: ServiceName): HealthRecord[] {
  const now = Date.now()
  const entries = (records.get(service) ?? []).filter(
    (r) => now - r.timestamp < WINDOW_MS,
  )
  records.set(service, entries)
  return entries
}

export const serviceHealth = {
  record(service: ServiceName, success: boolean): void {
    const entries = prune(service)
    entries.push({ timestamp: Date.now(), success })
    records.set(service, entries)
  },

  getStatus(service: ServiceName): ServiceStatus {
    const entries = prune(service)
    if (entries.length < MIN_SAMPLES) return 'healthy'

    const failures = entries.filter((r) => !r.success).length
    const rate = failures / entries.length

    if (rate > 0.75) return 'down'
    if (rate >= 0.25) return 'degraded'
    return 'healthy'
  },

  getAll(): Record<ServiceName, ServiceStatus> {
    const services: ServiceName[] = ['shopify', 'gmail', 'outlook', 'anthropic', 'whop']
    return Object.fromEntries(
      services.map((s) => [s, this.getStatus(s)]),
    ) as Record<ServiceName, ServiceStatus>
  },

  _reset(): void {
    records.clear()
  },
}
