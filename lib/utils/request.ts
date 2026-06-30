import type { NextRequest } from 'next/server'
import { ALLOWED_APP_ORIGINS } from '@/lib/allowed-origins'

/**
 * Derive the site URL from env first, fall back to the incoming request.
 * Avoids broken links when NEXT_PUBLIC_SITE_URL isn't set on Vercel.
 */
export function getSiteUrl(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  return host ? `${proto}://${host}` : ''
}

/**
 * Frontend origins the app is served from. Used to validate where OAuth flows
 * may redirect the user back to, so a connect started on one domain returns the
 * user to that same domain (never an attacker-controlled host).
 */
function allowedReturnOrigins(): string[] {
  const fromEnv = [process.env.NEXT_PUBLIC_APP_URL, process.env.NEXT_PUBLIC_SITE_URL]
    .filter((u): u is string => Boolean(u))
    .map((u) => u.replace(/\/$/, ''))
  return Array.from(new Set([...ALLOWED_APP_ORIGINS, ...fromEnv]))
}

/**
 * The origin the incoming request was made to (the domain the user is on).
 * Derived from forwarded headers so it works behind the Vercel proxy.
 */
export function getRequestOrigin(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  return host ? `${proto}://${host}` : ''
}

/**
 * Validate an OAuth `returnOrigin` against the allowlist. Falls back to
 * NEXT_PUBLIC_APP_URL (the canonical OAuth callback domain) when missing/unknown.
 */
export function safeReturnOrigin(candidate: string | null | undefined): string {
  const fallback = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
  if (!candidate) return fallback
  const normalized = candidate.replace(/\/$/, '')
  return allowedReturnOrigins().includes(normalized) ? normalized : fallback
}

/**
 * Parse ?from=YYYY-MM-DD&to=YYYY-MM-DD from request URL.
 * Falls back to start-of-current-month to today in Amsterdam timezone.
 * Returns bare YYYY-MM-DD strings — callers add time boundaries if needed.
 */
export function parseDateRange(request: { url: string }) {
  const { searchParams } = new URL(request.url)
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  if (fromParam && toParam) {
    return { from: fromParam, to: toParam }
  }

  // Default: start of current month -> today in Amsterdam timezone
  const now = new Date()
  const amsterdamNow = new Date(
    now.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })
  )
  const year = amsterdamNow.getFullYear()
  const month = String(amsterdamNow.getMonth() + 1).padStart(2, '0')
  const day = String(amsterdamNow.getDate()).padStart(2, '0')

  return {
    from: `${year}-${month}-01`,
    to: `${year}-${month}-${day}`,
  }
}
