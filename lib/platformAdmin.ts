import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ─── In-memory cache (per serverless instance) ──────────────────────
// Stores the role for known emails, or null for non-admin emails.
// 60s TTL — when an admin is removed, they retain access for up to
// 60 seconds. Acceptable: admin removal is rare and not time-critical.

const CACHE_TTL_MS = 60_000

interface CacheEntry {
  role: string | null
  ts: number
}

const cache = new Map<string, CacheEntry>()

async function getRole(email: string): Promise<string | null> {
  const now = Date.now()
  const cached = cache.get(email)
  if (cached && now - cached.ts < CACHE_TTL_MS) return cached.role

  const { data } = await supabaseAdmin
    .from('platform_admins')
    .select('role')
    .eq('email', email)
    .maybeSingle()

  const role = (data as { role: string } | null)?.role ?? null
  cache.set(email, { role, ts: now })
  return role
}

/**
 * True when the email belongs to a platform admin (full admin panel
 * access + payment bypass).
 */
export async function isPlatformAdmin(email: string | null | undefined): Promise<boolean> {
  if (!email) return false
  return (await getRole(email)) === 'admin'
}

/**
 * True when the email belongs to any privileged user (admin or tester).
 * Used for payment/subscription bypass — testers skip the payment gate
 * but cannot access the admin panel.
 */
export async function isPlatformAdminOrTester(email: string | null | undefined): Promise<boolean> {
  if (!email) return false
  const role = await getRole(email)
  return role === 'admin' || role === 'tester'
}
