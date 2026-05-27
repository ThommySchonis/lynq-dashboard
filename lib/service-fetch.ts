import { isServiceError } from '@/types/service-health'
import type { ServiceError } from '@/types/service-health'

export class ServiceFetchError extends Error {
  data: ServiceError
  constructor(message: string, data: ServiceError) {
    super(message)
    this.name = 'ServiceFetchError'
    this.data = data
  }
}

export async function serviceFetch<T>(url: string, init?: RequestInit): Promise<{ data: T; degraded?: boolean; message?: string }> {
  const res = await fetch(url, init)
  const json: unknown = await res.json()

  if (!res.ok && isServiceError(json)) {
    throw new ServiceFetchError(json.error, json)
  }
  if (!res.ok) {
    throw new Error(typeof json === 'object' && json !== null && 'error' in json
      ? String((json as Record<string, unknown>).error)
      : `Request failed: ${res.status}`)
  }

  return json as { data: T; degraded?: boolean; message?: string }
}
