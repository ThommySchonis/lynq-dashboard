import type { ServiceName, ServiceConfig } from '@/types/service-health'
import { serviceHealth } from '@/lib/service-health'

const SERVICE_CONFIGS: Record<ServiceName, ServiceConfig> = {
  shopify:   { retries: 2, timeoutMs: 10_000, retryDelayMs: 500 },
  gmail:     { retries: 2, timeoutMs: 10_000, retryDelayMs: 500 },
  outlook:   { retries: 2, timeoutMs: 10_000, retryDelayMs: 500 },
  anthropic: { retries: 1, timeoutMs: 30_000, retryDelayMs: 1_000 },
  whop:      { retries: 2, timeoutMs: 15_000, retryDelayMs: 500 },
}

export type ResilientResponse<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status: number; isTransient: boolean; service: ServiceName; retryAfter?: number }

function isTransientStatus(status: number, hasRetryAfter: boolean): boolean {
  if (status >= 500) return true
  if (status === 429 && hasRetryAfter) return true
  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseRetryAfter(res: Response): number | undefined {
  const header = res.headers.get('Retry-After')
  if (!header) return undefined
  const seconds = parseInt(header, 10)
  return Number.isFinite(seconds) ? seconds : undefined
}

export async function resilientFetch<T>(
  service: ServiceName,
  url: string,
  init?: RequestInit,
  configOverride?: Partial<ServiceConfig>,
): Promise<ResilientResponse<T>> {
  const cfg = { ...SERVICE_CONFIGS[service], ...configOverride }
  let lastError: string = 'Unknown error'
  let lastStatus = 0
  let retryAfter: number | undefined

  for (let attempt = 0; attempt <= cfg.retries; attempt++) {
    if (attempt > 0) {
      const delay = cfg.retryDelayMs * Math.pow(2, attempt - 1)
      await sleep(retryAfter ? retryAfter * 1000 : delay)
    }

    try {
      const res = await fetch(url, {
        ...init,
        signal: init?.signal ?? AbortSignal.timeout(cfg.timeoutMs),
      })

      if (res.ok) {
        serviceHealth.record(service, true)
        // Handle empty-body responses (e.g., 202 from Outlook send/reply)
        const text = await res.text()
        const data = text ? (JSON.parse(text) as T) : (undefined as T)
        return { ok: true, data, status: res.status }
      }

      lastStatus = res.status
      retryAfter = parseRetryAfter(res)
      const body = await res.text().catch(() => '')
      lastError = body || `HTTP ${res.status}`

      const hasRetryAfterHeader = retryAfter !== undefined
      if (!isTransientStatus(res.status, hasRetryAfterHeader)) {
        serviceHealth.record(service, false)
        return { ok: false, error: lastError, status: lastStatus, isTransient: false, service }
      }

      serviceHealth.record(service, false)
    } catch (err) {
      lastStatus = 0
      lastError = err instanceof Error ? err.message : 'Network error'
      serviceHealth.record(service, false)
    }
  }

  return { ok: false, error: lastError, status: lastStatus, isTransient: true, service, retryAfter }
}

export async function resilientSdkCall<T>(
  service: ServiceName,
  fn: () => Promise<T>,
  configOverride?: Partial<ServiceConfig>,
): Promise<T> {
  const cfg = { ...SERVICE_CONFIGS[service], ...configOverride }

  let lastError: unknown

  for (let attempt = 0; attempt <= cfg.retries; attempt++) {
    if (attempt > 0) {
      const delay = cfg.retryDelayMs * Math.pow(2, attempt - 1)
      await sleep(delay)
    }

    try {
      const result = await fn()
      serviceHealth.record(service, true)
      return result
    } catch (err) {
      lastError = err
      serviceHealth.record(service, false)

      const message = err instanceof Error ? err.message : ''
      if (message.includes('401') || message.includes('403') || message.includes('429')) {
        break
      }
    }
  }

  throw lastError
}
