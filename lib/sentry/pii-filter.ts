import type { ErrorEvent, EventHint } from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'

interface CacheEntry {
  level: string
  email: string | null
  expiresAt: number
}

const TTL_MS = 5 * 60 * 1000 // 5 minutes
const MAX_CACHE_SIZE = 500
const cache = new Map<string, CacheEntry>()

function pruneCache() {
  if (cache.size <= MAX_CACHE_SIZE) return
  const now = Date.now()
  for (const [key, entry] of cache) {
    if (entry.expiresAt < now) cache.delete(key)
  }
  // If still over limit after pruning expired, delete oldest entries
  if (cache.size > MAX_CACHE_SIZE) {
    const excess = cache.size - MAX_CACHE_SIZE
    const keys = cache.keys()
    for (let i = 0; i < excess; i++) {
      const next = keys.next()
      if (!next.done) cache.delete(next.value)
    }
  }
}

async function getConsent(
  supabase: SupabaseClient,
  userId: string
): Promise<CacheEntry> {
  const now = Date.now()
  const cached = cache.get(userId)
  if (cached && cached.expiresAt > now) return cached

  try {
    // Step 1: Get consent level from user_profiles
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('consent_level')
      .eq('user_id', userId)
      .maybeSingle()

    const level = (profile?.consent_level as string) ?? 'essential'
    let email: string | null = null

    // Step 2: Only fetch email if user consented to 'all'
    if (level === 'all') {
      const { data: userData } = await supabase.auth.admin.getUserById(userId)
      email = userData?.user?.email ?? null
    }

    const entry: CacheEntry = { level, email, expiresAt: now + TTL_MS }
    pruneCache()
    cache.set(userId, entry)
    return entry
  } catch {
    // Fail-safe: DB down → no PII
    return { level: 'essential', email: null, expiresAt: now + TTL_MS }
  }
}

export function createPiiFilter(supabase: SupabaseClient) {
  return async function beforeSend(
    event: ErrorEvent,
    _hint: EventHint
  ): Promise<ErrorEvent | null> {
    const userId = event.user?.id
    if (!userId || typeof userId !== 'string') return event // unauthenticated or non-string ID — nothing to enrich

    const consent = await getConsent(supabase, userId)

    if (consent.level === 'all' && consent.email) {
      event.user = { ...event.user, email: consent.email }
    }

    return event
  }
}
