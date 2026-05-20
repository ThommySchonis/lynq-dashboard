// In-memory sliding-window rate limiter.
// Temporary — replaced by PostgreSQL check_rate_limit RPC during Supabase migration.
// Limits are per Vercel serverless instance (approximate, not global).
// Keys are never evicted — acceptable for ~200 workspaces × 3 key types.

const windows = new Map<string, number[]>()

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now()
  const cutoff = now - windowMs
  const timestamps = (windows.get(key) ?? []).filter((t) => t > cutoff)

  if (timestamps.length >= limit) {
    const resetMs = timestamps[0] + windowMs - now
    windows.set(key, timestamps)
    return { allowed: false, remaining: 0, resetMs }
  }

  timestamps.push(now)
  windows.set(key, timestamps)
  return {
    allowed: true,
    remaining: limit - timestamps.length,
    resetMs: timestamps[0] + windowMs - now,
  }
}
