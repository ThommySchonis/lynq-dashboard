import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import type { ServiceName } from '@/types/service-health'
import { ShopifyApiError } from '@/lib/services/shopify'
import { WhopApiError } from '@/lib/whop'

interface CatchHandlerOptions {
  fallbackData?: unknown
  fallbackMessage?: string
}

export function serviceCatchHandler(
  error: unknown,
  service: ServiceName,
  options?: CatchHandlerOptions,
): NextResponse {
  const message = error instanceof Error ? error.message : 'Unknown error'
  const isTransient = classifyError(error)

  if (options?.fallbackData !== undefined) {
    Sentry.captureException(error, {
      level: 'warning',
      tags: { integration: service, transient: String(isTransient), degraded: 'true', retries_exhausted: 'true' },
    })
    return NextResponse.json({
      data: options.fallbackData,
      degraded: true,
      service,
      message: options.fallbackMessage ?? `Showing cached data — ${service} is temporarily unavailable`,
    })
  }

  Sentry.captureException(error, {
    tags: { integration: service, transient: String(isTransient), retries_exhausted: 'true' },
  })

  const status = getStatusCode(error)
  return NextResponse.json(
    { error: message, service, isTransient },
    { status },
  )
}

function classifyError(error: unknown): boolean {
  if (error instanceof ShopifyApiError) return error.statusCode >= 500
  if (error instanceof WhopApiError) return error.status >= 500 || error.status === 0
  if (error instanceof TypeError) return true
  if (error instanceof Error && error.name === 'AbortError') return true
  return true
}

function getStatusCode(error: unknown): number {
  if (error instanceof ShopifyApiError) {
    return error.statusCode >= 500 ? 502 : (error.statusCode || 502)
  }
  if (error instanceof WhopApiError) {
    if (error.status === 0 || error.status >= 500) return 502
    return error.status
  }
  return 502
}
