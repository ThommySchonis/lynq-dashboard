import { getAdminClient } from './supabase.ts'

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

  const { data } = await getAdminClient()
    .from('platform_admins')
    .select('role')
    .eq('email', email)
    .maybeSingle()

  const role = (data as { role: string } | null)?.role ?? null
  cache.set(email, { role, ts: now })
  return role
}

export async function isPlatformAdmin(email: string | null | undefined): Promise<boolean> {
  if (!email) return false
  return (await getRole(email)) === 'admin'
}

export async function isPlatformAdminOrTester(email: string | null | undefined): Promise<boolean> {
  if (!email) return false
  const role = await getRole(email)
  return role === 'admin' || role === 'tester'
}
