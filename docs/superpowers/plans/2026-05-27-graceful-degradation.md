# Graceful Degradation for External APIs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the platform remain partially operational with clear user feedback when Shopify, Gmail, Outlook, Anthropic, or Whop experience outages.

**Architecture:** A shared `resilientFetch()` wrapper handles retry/timeout/error-classification for all raw-fetch services. A separate `resilientSdkCall()` handles Anthropic (Vercel AI SDK). An in-memory `ServiceHealthRegistry` tracks per-service failure rates. A Zustand store + frontend components (banner, retry button) surface degradation state to users. API routes return structured error responses with cached-data fallback for read operations.

**Tech Stack:** Next.js 16 (app router), React 19, TanStack React Query v5, Zustand, Supabase, Sentry, Vercel

**Spec:** `docs/superpowers/specs/2026-05-27-graceful-degradation-design.md`

---

## File Map

### New files

| File | Responsibility |
|------|----------------|
| `types/service-health.ts` | Shared types: `ServiceName`, `ServiceStatus`, `ServiceConfig`, response shapes |
| `lib/resilient-fetch.ts` | `resilientFetch()` wrapper + `resilientSdkCall()` for AI SDK + per-service config |
| `lib/service-health.ts` | `ServiceHealthRegistry` singleton — sliding-window failure tracking |
| `lib/service-catch-handler.ts` | `serviceCatchHandler()` — structured error responses for API routes |
| `stores/service-health.ts` | Zustand store for frontend service health state |
| `hooks/use-service-health-poller.ts` | Recovery polling hook (30s interval when degraded) |
| `components/shared/service-banner.tsx` | Dismissible degradation warning banner |
| `components/shared/retry-button.tsx` | Retry button for failed transient mutations |
| `lib/service-fetch.ts` | `serviceFetch()` — frontend-facing fetch wrapper that throws `ServiceFetchError` |
| `app/api/health/services/route.ts` | Health status endpoint |

### Modified files

| File | Change |
|------|--------|
| `lib/services/shopify.ts` | Replace `shopifyFetch`/`shopifyFetchJSON` internals with `resilientFetch` |
| `lib/providers/gmail.ts` | Replace raw `fetch` with `resilientFetch` |
| `lib/providers/outlook.ts` | Replace raw `fetch` with `resilientFetch` |
| `lib/whop.ts` | Replace raw `fetch` with `resilientFetch` |
| `app/api/ai/reply/route.ts` | Wrap `generateText` with `resilientSdkCall`, structured errors |
| `app/api/ai/chat/route.ts` | try/catch around `streamText`, record health, structured errors |
| `app/api/ai/translate/route.ts` | Wrap SDK call with `resilientSdkCall` |
| `app/api/ai/macros/route.ts` | Wrap SDK call with `resilientSdkCall` |
| `app/api/ai/analyze/route.ts` | Wrap SDK call with `resilientSdkCall` |
| `app/api/translate/route.ts` | Wrap SDK call with `resilientSdkCall` |
| `app/api/analytics/refund-insights/route.ts` | Wrap SDK call with `resilientSdkCall` |
| `app/api/exams/submit/route.ts` | Wrap SDK call with `resilientSdkCall` |
| `app/api/shopify/orders/route.ts` | Add degraded-success fallback from `shopify_orders` |
| `app/api/shopify/kpis/route.ts` | Add degraded-success fallback from `shopify_orders` |
| `app/api/shopify/analytics/route.ts` | Add degraded-success fallback |
| `app/api/shopify/refunds/route.ts` | Add degraded-success fallback |
| `app/api/shopify/revenue-trend/route.ts` | Add degraded-success fallback |
| `app/api/shopify/customer/route.ts` | Add structured error (no cache) |
| `app/api/shopify/cancel-order/route.ts` | Add structured error (mutation) |
| `app/api/shopify/edit-address/route.ts` | Add structured error (mutation) |
| `app/api/shopify/refund-order/route.ts` | Add structured error (mutation) |
| `app/api/shopify/duplicate-order/route.ts` | Add structured error (mutation) |
| `app/api/inbox/conversations/route.ts` | Add degraded-success fallback from `email_conversations` |
| `app/api/inbox/counts/route.ts` | Add degraded-success fallback |
| `app/api/inbox/compose/route.ts` | Add structured error (mutation) |
| `app/api/billing/subscription/route.ts` | Add degraded-success fallback from `workspace_subscriptions` |
| `app/api/billing/invoices/route.ts` | Add degraded-success fallback from `invoices` |
| `app/api/billing/usage/route.ts` | Add degraded-success fallback |
| `components/providers/query-provider.tsx` | Add `QueryCache`/`MutationCache` with `onError` for health tracking |
| `app/(protected)/layout.tsx` | Add `<ServiceBanner />` |

---

## Task 1: Shared Types

**Files:**
- Create: `types/service-health.ts`

- [ ] **Step 1: Create the shared types file**

```typescript
// types/service-health.ts

export type ServiceName = 'shopify' | 'gmail' | 'outlook' | 'anthropic' | 'whop'
export type ServiceStatus = 'healthy' | 'degraded' | 'down'

export interface ServiceConfig {
  retries: number
  timeoutMs: number
  retryDelayMs: number
}

/** Error branch of resilientFetch / API error responses */
export interface ServiceError {
  error: string
  service: ServiceName
  isTransient: boolean
  retryAfter?: number
  degraded?: boolean
}

/** Degraded success — cached data returned when live API fails */
export interface DegradedSuccess<T> {
  data: T
  degraded: true
  service: ServiceName
  message: string
}

/** Union returned by API routes that support degradation */
export type ServiceResponse<T> =
  | { data: T }
  | DegradedSuccess<T>
  | ServiceError

/** Type guard: is this a service error response? */
export function isServiceError(obj: unknown): obj is ServiceError {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'error' in obj &&
    'service' in obj &&
    'isTransient' in obj
  )
}
```

- [ ] **Step 2: Verify no lint errors**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npx eslint types/service-health.ts`
Expected: No errors

---

## Task 2: Service Health Registry

**Files:**
- Create: `lib/service-health.ts`

- [ ] **Step 1: Create the registry**

```typescript
// lib/service-health.ts

import type { ServiceName, ServiceStatus } from '@/types/service-health'

interface HealthRecord {
  timestamp: number
  success: boolean
}

const WINDOW_MS = 60_000 // 60 seconds
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

  /** Reset all records — useful for testing */
  _reset(): void {
    records.clear()
  },
}
```

- [ ] **Step 2: Verify no lint errors**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npx eslint lib/service-health.ts`
Expected: No errors

---

## Task 3: Resilient Fetch Utility

**Files:**
- Create: `lib/resilient-fetch.ts`

- [ ] **Step 1: Create the resilient fetch wrapper**

```typescript
// lib/resilient-fetch.ts

import type { ServiceName, ServiceConfig } from '@/types/service-health'
import { serviceHealth } from '@/lib/service-health'

// ── Per-service defaults ────────────────────────────────────────────────────

const SERVICE_CONFIGS: Record<ServiceName, ServiceConfig> = {
  shopify:   { retries: 2, timeoutMs: 10_000, retryDelayMs: 500 },
  gmail:     { retries: 2, timeoutMs: 10_000, retryDelayMs: 500 },
  outlook:   { retries: 2, timeoutMs: 10_000, retryDelayMs: 500 },
  anthropic: { retries: 1, timeoutMs: 30_000, retryDelayMs: 1_000 },
  whop:      { retries: 2, timeoutMs: 15_000, retryDelayMs: 500 },
}

// ── Response type ───────────────────────────────────────────────────────────

export type ResilientResponse<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status: number; isTransient: boolean; service: ServiceName; retryAfter?: number }

// ── Helpers ─────────────────────────────────────────────────────────────────

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

// ── resilientFetch ──────────────────────────────────────────────────────────

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
        const data = (await res.json()) as T
        return { ok: true, data, status: res.status }
      }

      // Non-OK response
      lastStatus = res.status
      retryAfter = parseRetryAfter(res)
      const body = await res.text().catch(() => '')
      lastError = body || `HTTP ${res.status}`

      const hasRetryAfterHeader = retryAfter !== undefined
      if (!isTransientStatus(res.status, hasRetryAfterHeader)) {
        // Permanent error — don't retry
        serviceHealth.record(service, false)
        return { ok: false, error: lastError, status: lastStatus, isTransient: false, service }
      }

      // Transient — will retry if attempts remain
      serviceHealth.record(service, false)
    } catch (err) {
      // Network error or timeout
      lastStatus = 0
      lastError = err instanceof Error ? err.message : 'Network error'
      serviceHealth.record(service, false)
    }
  }

  // All retries exhausted
  return { ok: false, error: lastError, status: lastStatus, isTransient: true, service, retryAfter }
}

// ── resilientSdkCall (for Vercel AI SDK) ────────────────────────────────────

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

      // Don't retry rate limits or auth errors
      const message = err instanceof Error ? err.message : ''
      if (message.includes('401') || message.includes('403') || message.includes('429')) {
        break
      }
    }
  }

  throw lastError
}
```

- [ ] **Step 2: Verify no lint errors**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npx eslint lib/resilient-fetch.ts`
Expected: No errors

---

## Task 4: Service Catch Handler

**Files:**
- Create: `lib/service-catch-handler.ts`

- [ ] **Step 1: Create the shared error handler**

```typescript
// lib/service-catch-handler.ts

import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import type { ServiceName } from '@/types/service-health'
import { ShopifyApiError } from '@/lib/services/shopify'
import { WhopApiError } from '@/lib/whop'

interface CatchHandlerOptions {
  /** If provided, return this as degraded success instead of an error */
  fallbackData?: unknown
  /** Human-readable message for degraded responses */
  fallbackMessage?: string
}

export function serviceCatchHandler(
  error: unknown,
  service: ServiceName,
  options?: CatchHandlerOptions,
): NextResponse {
  const message = error instanceof Error ? error.message : 'Unknown error'
  const isTransient = classifyError(error)

  // If we have cached fallback data, return degraded success.
  // Only log to Sentry at 'warning' level (not error) since the user gets data.
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

  // No fallback — real error. Report to Sentry at error level.
  // resilientFetch already exhausted retries before throwing, so all errors here are final.
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
  if (error instanceof TypeError) return true // network error
  if (error instanceof Error && error.name === 'AbortError') return true // timeout
  // Default: treat unknown errors as transient (safer — allows retry)
  return true
}

function getStatusCode(error: unknown): number {
  if (error instanceof ShopifyApiError) {
    return error.statusCode >= 500 ? 502 : (error.statusCode || 502)
  }
  if (error instanceof WhopApiError) {
    // WhopApiError.status is 0 for network errors — map to 502
    if (error.status === 0 || error.status >= 500) return 502
    return error.status
  }
  return 502
}
```

- [ ] **Step 2: Verify no lint errors**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npx eslint lib/service-catch-handler.ts`
Expected: No errors

---

## Task 5: Health API Endpoint

**Files:**
- Create: `app/api/health/services/route.ts`

Check the `api-route-rules` skill before writing this file.

- [ ] **Step 1: Create the health endpoint**

@ api-route-rules

```typescript
// app/api/health/services/route.ts

import { NextResponse } from 'next/server'
import { serviceHealth } from '@/lib/service-health'

export async function GET() {
  return NextResponse.json({ statuses: serviceHealth.getAll() })
}
```

- [ ] **Step 2: Verify no lint errors**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npx eslint app/api/health/services/route.ts`
Expected: No errors

---

## Task 6: Zustand Service Health Store

**Files:**
- Create: `stores/service-health.ts`

- [ ] **Step 1: Create the store**

```typescript
// stores/service-health.ts

import { create } from 'zustand'
import type { ServiceName, ServiceStatus } from '@/types/service-health'

const ALL_SERVICES: ServiceName[] = ['shopify', 'gmail', 'outlook', 'anthropic', 'whop']

function defaultStatuses(): Record<ServiceName, ServiceStatus> {
  return Object.fromEntries(
    ALL_SERVICES.map((s) => [s, 'healthy' as const]),
  ) as Record<ServiceName, ServiceStatus>
}

interface ServiceHealthState {
  statuses: Record<ServiceName, ServiceStatus>
  lastUpdated: Record<ServiceName, number>

  setStatus: (service: ServiceName, status: ServiceStatus) => void
  setAll: (statuses: Record<ServiceName, ServiceStatus>) => void
  isHealthy: (service: ServiceName) => boolean
}

export const useServiceHealthStore = create<ServiceHealthState>()((set, get) => ({
  statuses: defaultStatuses(),
  lastUpdated: Object.fromEntries(
    ALL_SERVICES.map((s) => [s, 0]),
  ) as Record<ServiceName, number>,

  setStatus: (service, status) =>
    set((state) => ({
      statuses: { ...state.statuses, [service]: status },
      lastUpdated: { ...state.lastUpdated, [service]: Date.now() },
    })),

  setAll: (statuses) =>
    set({
      statuses,
      lastUpdated: Object.fromEntries(
        ALL_SERVICES.map((s) => [s, Date.now()]),
      ) as Record<ServiceName, number>,
    }),

  isHealthy: (service) => get().statuses[service] === 'healthy',
}))
```

- [ ] **Step 2: Verify no lint errors**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npx eslint stores/service-health.ts`
Expected: No errors

---

## Task 7: Service Health Poller Hook

**Files:**
- Create: `hooks/use-service-health-poller.ts`

- [ ] **Step 1: Create the recovery polling hook**

@ component-rules

```typescript
// hooks/use-service-health-poller.ts

'use client'

import { useEffect, useRef } from 'react'
import { useServiceHealthStore } from '@/stores/service-health'
import type { ServiceName, ServiceStatus } from '@/types/service-health'

const POLL_INTERVAL_MS = 30_000

export function useServiceHealthPoller() {
  const statuses = useServiceHealthStore((s) => s.statuses)
  const setAll = useServiceHealthStore((s) => s.setAll)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const hasUnhealthy = Object.values(statuses).some((s) => s !== 'healthy')

  useEffect(() => {
    if (!hasUnhealthy) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    async function poll() {
      try {
        const res = await fetch('/api/health/services')
        if (res.ok) {
          const json = (await res.json()) as { statuses: Record<ServiceName, ServiceStatus> }
          setAll(json.statuses)
        }
      } catch {
        // Polling failure is non-critical — skip
      }
    }

    // Poll immediately, then on interval
    poll()
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [hasUnhealthy, setAll])
}
```

- [ ] **Step 2: Verify no lint errors**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npx eslint hooks/use-service-health-poller.ts`
Expected: No errors

---

## Task 8: ServiceBanner Component

**Files:**
- Create: `components/shared/service-banner.tsx`
- Modify: `app/(protected)/layout.tsx`

@ component-rules

- [ ] **Step 1: Create the banner component**

```typescript
// components/shared/service-banner.tsx

'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { useServiceHealthStore } from '@/stores/service-health'
import { useServiceHealthPoller } from '@/hooks/use-service-health-poller'
import type { ServiceName, ServiceStatus } from '@/types/service-health'

const SERVICE_LABELS: Record<ServiceName, string> = {
  shopify: 'Shopify',
  gmail: 'Email (Gmail)',
  outlook: 'Email (Outlook)',
  anthropic: 'AI features',
  whop: 'Billing',
}

function getMessage(service: ServiceName, status: ServiceStatus): string {
  const label = SERVICE_LABELS[service]
  if (status === 'down') return `${label} is currently unavailable — some features may not work`
  return `${label} is experiencing issues — showing cached data where available`
}

export function ServiceBanner() {
  useServiceHealthPoller()

  const statuses = useServiceHealthStore((s) => s.statuses)
  const [dismissed, setDismissed] = useState<Set<ServiceName>>(new Set())

  const unhealthy = (Object.entries(statuses) as [ServiceName, ServiceStatus][]).filter(
    ([service, status]) => status !== 'healthy' && !dismissed.has(service),
  )

  if (unhealthy.length === 0) return null

  return (
    <div className="flex flex-col gap-1 px-4 pt-2">
      {unhealthy.map(([service, status]) => (
        <div
          key={service}
          className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
            status === 'down'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-warning/10 text-warning'
          }`}
        >
          <span>{getMessage(service, status)}</span>
          <button
            onClick={() => setDismissed((prev) => new Set(prev).add(service))}
            className="ml-2 shrink-0 rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/5"
            aria-label={`Dismiss ${SERVICE_LABELS[service]} alert`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Add ServiceBanner to the protected layout**

Modify `app/(protected)/layout.tsx`:

```typescript
import { AuthGuard } from '@/components/shared/auth-guard'
import { ServiceBanner } from '@/components/shared/service-banner'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <ServiceBanner />
      {children}
    </AuthGuard>
  )
}
```

- [ ] **Step 3: Verify no lint errors**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npx eslint components/shared/service-banner.tsx app/\(protected\)/layout.tsx`
Expected: No errors

---

## Task 9: RetryButton Component

**Files:**
- Create: `components/shared/retry-button.tsx`

@ component-rules

- [ ] **Step 1: Create the retry button component**

```typescript
// components/shared/retry-button.tsx

'use client'

import { Button } from '@/components/ui/button'
import { RotateCw } from 'lucide-react'

interface RetryButtonProps {
  onRetry: () => void
  isRetrying?: boolean
  className?: string
}

export function RetryButton({ onRetry, isRetrying, className }: RetryButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onRetry}
      disabled={isRetrying}
      className={className}
    >
      <RotateCw className={`mr-1.5 h-3.5 w-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
      {isRetrying ? 'Retrying…' : 'Retry'}
    </Button>
  )
}
```

- [ ] **Step 2: Verify no lint errors**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npx eslint components/shared/retry-button.tsx`
Expected: No errors

---

## Task 10: Wire QueryCache/MutationCache Error Callbacks

**Files:**
- Modify: `components/providers/query-provider.tsx`

@ component-rules

- [ ] **Step 1: Update QueryProvider with error callbacks**

Replace the current `query-provider.tsx` content. The key change: add `QueryCache` and `MutationCache` with `onError` callbacks that update the service health Zustand store when API responses contain `service` + `isTransient` fields.

First, create `lib/service-fetch.ts` with the shared fetch wrapper and error class:

```typescript
// lib/service-fetch.ts

import { isServiceError } from '@/types/service-health'
import type { ServiceError } from '@/types/service-health'

/**
 * Custom error that carries the structured service error from API responses.
 * TanStack Query v5 passes the raw Error to onError callbacks — this class
 * lets the QueryCache/MutationCache onError handler extract the service info.
 */
export class ServiceFetchError extends Error {
  data: ServiceError
  constructor(message: string, data: ServiceError) {
    super(message)
    this.name = 'ServiceFetchError'
    this.data = data
  }
}

/**
 * Shared fetch wrapper for hooks. Use this in query/mutation functions
 * instead of raw `fetch` so errors carry structured service info.
 *
 * Usage in hooks:
 *   const res = await serviceFetch('/api/shopify/orders')
 *   return res.data
 */
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
```

Then update `query-provider.tsx`:

```typescript
// components/providers/query-provider.tsx

'use client'

import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query'
import { useState } from 'react'
import { useServiceHealthStore } from '@/stores/service-health'
import { ServiceFetchError } from '@/lib/service-fetch'

function handleServiceError(error: unknown) {
  if (error instanceof ServiceFetchError) {
    const store = useServiceHealthStore.getState()
    const { service, isTransient } = error.data
    store.setStatus(service, isTransient ? 'degraded' : 'down')
  }
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: handleServiceError,
        }),
        mutationCache: new MutationCache({
          onError: handleServiceError,
        }),
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

Note: This task also introduces `serviceFetch()` — a shared fetch wrapper that hooks should use instead of raw `fetch`. When an API route returns a structured service error, `serviceFetch` throws a `ServiceFetchError` that carries the parsed error body, which the `QueryCache`/`MutationCache` `onError` callbacks can then inspect. Existing hooks that call external-service API routes should be migrated to use `serviceFetch` in Tasks 16-18 when modifying those routes.

- [ ] **Step 2: Verify no lint errors**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npx eslint components/providers/query-provider.tsx`
Expected: No errors

---

## Task 11: Integrate resilientFetch into Shopify Service

**Files:**
- Modify: `lib/services/shopify.ts`

- [ ] **Step 1: Replace shopifyFetch/shopifyFetchJSON with resilientFetch**

Read `lib/services/shopify.ts` fully to understand `shopifyFetch()` and `shopifyFetchJSON()` helper shapes.

Replace the internal `fetch` calls inside `shopifyFetch` and `shopifyFetchJSON` with `resilientFetch('shopify', ...)`. Keep the existing `ShopifyApiError` class — throw it when `resilientFetch` returns `{ ok: false }` with `isTransient: false`. For transient failures, also throw `ShopifyApiError` but let the caller (API route) decide whether to fallback to cached data.

Add import at top:
```typescript
import { resilientFetch } from '@/lib/resilient-fetch'
```

Modify `shopifyFetchJSON` to use resilientFetch internally. The existing retry-on-429 logic in pagination functions (like `getRefunds`) can be simplified since `resilientFetch` already handles 429/retry.

- [ ] **Step 2: Verify no lint errors**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npx eslint lib/services/shopify.ts`
Expected: No errors

---

## Task 12: Integrate resilientFetch into Gmail Provider

**Files:**
- Modify: `lib/providers/gmail.ts`

- [ ] **Step 1: Replace raw fetch calls with resilientFetch**

Read `lib/providers/gmail.ts` fully. Replace all `fetch()` calls to Gmail API endpoints (`https://gmail.googleapis.com/...`) with `resilientFetch('gmail', ...)`. Keep the token-refresh `fetch` call to `https://oauth2.googleapis.com/token` as-is (that's an auth call, not a data call).

Add import:
```typescript
import { resilientFetch } from '@/lib/resilient-fetch'
```

For each Gmail API call, replace:
```typescript
const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
```
With:
```typescript
const result = await resilientFetch<GmailResponseType>('gmail', url, { headers: { Authorization: `Bearer ${token}` } })
if (!result.ok) throw new Error(result.error)
const data = result.data
```

- [ ] **Step 2: Verify no lint errors**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npx eslint lib/providers/gmail.ts`
Expected: No errors

---

## Task 13: Integrate resilientFetch into Outlook Provider

**Files:**
- Modify: `lib/providers/outlook.ts`

- [ ] **Step 1: Replace raw fetch calls with resilientFetch**

Same pattern as Gmail (Task 12). Read `lib/providers/outlook.ts` fully. Replace all `fetch()` calls to Microsoft Graph API (`https://graph.microsoft.com/...`) with `resilientFetch('outlook', ...)`. Keep the token-refresh `fetch` to `https://login.microsoftonline.com/...` as-is.

Add import:
```typescript
import { resilientFetch } from '@/lib/resilient-fetch'
```

- [ ] **Step 2: Verify no lint errors**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npx eslint lib/providers/outlook.ts`
Expected: No errors

---

## Task 14: Integrate resilientFetch into Whop

**Files:**
- Modify: `lib/whop.ts`

- [ ] **Step 1: Replace raw fetch calls with resilientFetch**

Read `lib/whop.ts` fully. The file already has a central `whopFetch()` helper with its own error handling, Sentry reporting, and 15s timeout. Replace the internal `fetch` inside `whopFetch()` with `resilientFetch('whop', ...)`. Remove the manual `AbortSignal.timeout(15_000)` and Sentry reporting from `whopFetch` since `resilientFetch` handles timeout and `serviceCatchHandler` handles Sentry.

Keep `WhopApiError` — throw it when `resilientFetch` returns `{ ok: false }`.

Add import:
```typescript
import { resilientFetch } from '@/lib/resilient-fetch'
```

- [ ] **Step 2: Verify no lint errors**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npx eslint lib/whop.ts`
Expected: No errors

---

## Task 15: Wrap AI Routes with resilientSdkCall

**Files:**
- Modify: `app/api/ai/reply/route.ts`
- Modify: `app/api/ai/chat/route.ts`
- Modify: `app/api/ai/translate/route.ts`
- Modify: `app/api/ai/macros/route.ts`
- Modify: `app/api/ai/analyze/route.ts`
- Modify: `app/api/translate/route.ts`
- Modify: `app/api/analytics/refund-insights/route.ts`
- Modify: `app/api/exams/submit/route.ts`

@ api-route-rules

- [ ] **Step 1: Update ai/reply route**

Read `app/api/ai/reply/route.ts`. Wrap the `generateText()` call with `resilientSdkCall` and add `serviceCatchHandler` in the catch block.

Add imports:
```typescript
import { resilientSdkCall } from '@/lib/resilient-fetch'
import { serviceCatchHandler } from '@/lib/service-catch-handler'
```

Replace the bare `generateText` call:
```typescript
// Before:
const { text, usage } = await generateText({ ... })

// After:
const { text, usage } = await resilientSdkCall('anthropic', () =>
  generateText({ ... })
)
```

Wrap the entire section from `generateText` through the response in a try/catch:
```typescript
try {
  const { text, usage } = await resilientSdkCall('anthropic', () =>
    generateText({ ... })
  )
  // ... ai_usage insert + return response ...
} catch (err) {
  return serviceCatchHandler(err, 'anthropic')
}
```

- [ ] **Step 2: Update ai/chat route**

Read `app/api/ai/chat/route.ts`. This uses `streamText` — do NOT wrap with `resilientSdkCall` (streams can't be retried). Instead, wrap in try/catch, record to health registry, and return structured error.

Add imports:
```typescript
import { serviceHealth } from '@/lib/service-health'
import { serviceCatchHandler } from '@/lib/service-catch-handler'
```

Wrap the `streamText` call. Note: `record(true)` here only confirms the initial connection succeeded — mid-stream failures are handled client-side (the frontend already shows "Something went wrong"). The AI SDK's `onFinish` callback can be used to record stream completion if needed in a follow-up.

```typescript
try {
  const result = streamText({ ... })
  // Records initial connection success only — mid-stream failures
  // are not captured here (handled by frontend error state)
  serviceHealth.record('anthropic', true)
  return result.toDataStreamResponse()
} catch (err) {
  serviceHealth.record('anthropic', false)
  return serviceCatchHandler(err, 'anthropic')
}
```

- [ ] **Step 3: Update remaining AI routes**

For each of these files, read the file, then apply the same pattern as Step 1 (`resilientSdkCall` + `serviceCatchHandler`):
- `app/api/ai/translate/route.ts`
- `app/api/ai/macros/route.ts`
- `app/api/ai/analyze/route.ts`
- `app/api/translate/route.ts`
- `app/api/analytics/refund-insights/route.ts`
- `app/api/exams/submit/route.ts`

- [ ] **Step 4: Verify no lint errors on all modified AI routes**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npx eslint app/api/ai/reply/route.ts app/api/ai/chat/route.ts app/api/ai/translate/route.ts app/api/ai/macros/route.ts app/api/ai/analyze/route.ts app/api/translate/route.ts app/api/analytics/refund-insights/route.ts app/api/exams/submit/route.ts`
Expected: No errors

---

## Task 16: Add Degraded-Success Fallback to Shopify Read Routes

**Files:**
- Modify: `app/api/shopify/orders/route.ts`
- Modify: `app/api/shopify/kpis/route.ts`
- Modify: `app/api/shopify/analytics/route.ts`
- Modify: `app/api/shopify/refunds/route.ts`
- Modify: `app/api/shopify/revenue-trend/route.ts`

@ api-route-rules

- [ ] **Step 1: Add fallback to orders route**

Read `app/api/shopify/orders/route.ts`. Wrap the service call in try/catch. In the catch block, query `shopify_orders` from Supabase (scoped by `workspace_id`) and return degraded success via `serviceCatchHandler` with `fallbackData`.

Pattern:
```typescript
import { serviceCatchHandler } from '@/lib/service-catch-handler'

try {
  // ... existing service call ...
} catch (err) {
  // Fallback: serve cached orders from Supabase
  const { data: cached } = await supabaseAdmin
    .from('shopify_orders')
    .select('*')
    .eq('workspace_id', ctx.workspaceId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (cached && cached.length > 0) {
    return serviceCatchHandler(err, 'shopify', {
      fallbackData: cached,
      fallbackMessage: 'Showing cached orders — Shopify is temporarily unavailable',
    })
  }
  return serviceCatchHandler(err, 'shopify')
}
```

- [ ] **Step 2: Add fallback to remaining Shopify read routes**

Apply the same pattern to:
- `app/api/shopify/kpis/route.ts` — fallback from `shopify_orders` aggregation
- `app/api/shopify/analytics/route.ts` — fallback from `shopify_orders`
- `app/api/shopify/refunds/route.ts` — fallback from `shopify_orders` where `financial_status` includes refund
- `app/api/shopify/revenue-trend/route.ts` — fallback from `shopify_orders`

Read each file first to understand the current response shape, then match it in the fallback.

- [ ] **Step 3: Add structured errors to Shopify mutation routes**

For mutation routes that have no cache fallback, just add `serviceCatchHandler` in the catch block:
- `app/api/shopify/cancel-order/route.ts`
- `app/api/shopify/edit-address/route.ts`
- `app/api/shopify/refund-order/route.ts`
- `app/api/shopify/duplicate-order/route.ts`

```typescript
import { serviceCatchHandler } from '@/lib/service-catch-handler'

try {
  // ... existing code ...
} catch (err) {
  return serviceCatchHandler(err, 'shopify')
}
```

- [ ] **Step 4: Verify no lint errors**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npx eslint app/api/shopify/*/route.ts`
Expected: No errors

---

## Task 17: Add Degraded-Success Fallback to Inbox Routes

**Files:**
- Modify: `app/api/inbox/conversations/route.ts`
- Modify: `app/api/inbox/counts/route.ts`
- Modify: `app/api/inbox/compose/route.ts`

@ api-route-rules

- [ ] **Step 1: Add fallback to conversations route**

Read `app/api/inbox/conversations/route.ts`. Wrap the service call that fetches from Gmail/Outlook in try/catch. In the catch, fall back to `email_conversations` + `email_messages` from Supabase.

```typescript
import { serviceCatchHandler } from '@/lib/service-catch-handler'

// In the catch block — determine which service failed:
const service = /* detect from error or account type */ 'gmail' // or 'outlook'
const { data: cached } = await supabaseAdmin
  .from('email_conversations')
  .select('*, email_messages(*)')
  .eq('workspace_id', ctx.workspaceId)
  .order('last_message_at', { ascending: false })
  .limit(50)

if (cached && cached.length > 0) {
  return serviceCatchHandler(err, service, {
    fallbackData: cached,
    fallbackMessage: 'Showing cached conversations — email service is temporarily unavailable',
  })
}
return serviceCatchHandler(err, service)
```

- [ ] **Step 2: Add fallback to counts route and structured error to compose route**

- `inbox/counts/route.ts` — fallback from Supabase count query
- `inbox/compose/route.ts` — mutation, no fallback, just `serviceCatchHandler`

- [ ] **Step 3: Verify no lint errors**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npx eslint app/api/inbox/*/route.ts`
Expected: No errors

---

## Task 18: Add Degraded-Success Fallback to Billing Routes

**Files:**
- Modify: `app/api/billing/subscription/route.ts`
- Modify: `app/api/billing/invoices/route.ts`
- Modify: `app/api/billing/usage/route.ts`

@ api-route-rules

- [ ] **Step 1: Add fallback to billing read routes**

Read each file. Wrap Whop API calls in try/catch with Supabase fallback:

- `billing/subscription/route.ts` — fallback from `workspace_subscriptions` table
- `billing/invoices/route.ts` — fallback from `invoices` table
- `billing/usage/route.ts` — fallback from `usage_counters` table

```typescript
import { serviceCatchHandler } from '@/lib/service-catch-handler'

try {
  // ... existing Whop API call ...
} catch (err) {
  const { data: cached } = await supabaseAdmin
    .from('workspace_subscriptions')
    .select('*')
    .eq('workspace_id', ctx.workspaceId)
    .single()

  if (cached) {
    return serviceCatchHandler(err, 'whop', {
      fallbackData: cached,
      fallbackMessage: 'Showing cached billing data — billing service is temporarily unavailable',
    })
  }
  return serviceCatchHandler(err, 'whop')
}
```

- [ ] **Step 2: Verify no lint errors**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npx eslint app/api/billing/*/route.ts`
Expected: No errors

---

## Task 19: Full Lint Check

- [ ] **Step 1: Run full project lint**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npm run lint`
Expected: No new errors. Fix any that appear.

---

## Task 20: Manual Smoke Test Verification

- [ ] **Step 1: Verify the app builds**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npm run build`
Expected: Build succeeds with no type errors

- [ ] **Step 2: Document test scenarios**

Create a checklist for manual verification:

1. **Shopify down:** Disconnect Shopify API key temporarily → verify orders page shows cached data with banner
2. **Gmail down:** Revoke Gmail token temporarily → verify inbox shows cached conversations with banner
3. **AI down:** Set invalid Anthropic API key → verify AI reply shows structured error, retry button works
4. **Whop down:** Block Whop API calls → verify billing page shows cached subscription data with banner
5. **Recovery:** Restore service → verify banner disappears after poller detects recovery (~30s)
6. **Mutations:** While Shopify is down, try edit-address → verify structured error with retry button, no cached fallback
