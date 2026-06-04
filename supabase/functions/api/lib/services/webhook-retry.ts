// Progressive backoff delays: 30s, 2m, 10m, 30m, 1h, 2h, 4h
export const RETRY_DELAYS_MS = [
  30_000,
  120_000,
  600_000,
  1_800_000,
  3_600_000,
  7_200_000,
  14_400_000,
] as const

export const MAX_ATTEMPTS = 8

/**
 * Compute the next retry timestamp based on attempt count.
 * Returns null when max attempts are exhausted (dead letter).
 */
export function computeNextRetryAt(attemptCount: number): string | null {
  const index = attemptCount - 1
  if (index < 0 || index >= RETRY_DELAYS_MS.length) return null
  return new Date(Date.now() + RETRY_DELAYS_MS[index]).toISOString()
}
