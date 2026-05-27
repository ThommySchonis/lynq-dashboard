export type ServiceName = 'shopify' | 'gmail' | 'outlook' | 'anthropic' | 'whop'
export type ServiceStatus = 'healthy' | 'degraded' | 'down'

export interface ServiceConfig {
  retries: number
  timeoutMs: number
  retryDelayMs: number
}

export interface ServiceError {
  error: string
  service: ServiceName
  isTransient: boolean
  retryAfter?: number
  degraded?: boolean
}

export interface DegradedSuccess<T> {
  data: T
  degraded: true
  service: ServiceName
  message: string
}

export type ServiceResponse<T> =
  | { data: T }
  | DegradedSuccess<T>
  | ServiceError

export function isServiceError(obj: unknown): obj is ServiceError {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'error' in obj &&
    'service' in obj &&
    'isTransient' in obj
  )
}
