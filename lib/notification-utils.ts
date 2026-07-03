/**
 * Compact timestamp used in the notifications modal rows: `now`, `12m`, `1h`,
 * else an absolute short date like `Apr 24` (no "ago"). Matches Figma.
 */
export function formatCompactTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'now'
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Start-of-day for a date, in local time. */
function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export interface NotificationDateGroup<T> {
  /** Stable key: `today` | `yesterday` | ISO date (`2026-04-24`). */
  key: string
  /** Display label: `Today` | `Yesterday` | short date (`Apr 24`). */
  label: string
  items: T[]
}

/**
 * Buckets notifications into Today / Yesterday / per-day sections by
 * `created_at`, preserving the incoming (already sorted, newest-first) order.
 */
export function groupNotificationsByDate<T extends { created_at: string }>(
  items: T[],
): NotificationDateGroup<T>[] {
  const now = new Date()
  const todayStart = startOfLocalDay(now)
  const dayMs = 86_400_000
  const groups: NotificationDateGroup<T>[] = []
  const byKey = new Map<string, NotificationDateGroup<T>>()

  for (const item of items) {
    const created = new Date(item.created_at)
    const dayStart = startOfLocalDay(created)
    const daysAgo = Math.round((todayStart - dayStart) / dayMs)

    let key: string
    let label: string
    if (daysAgo <= 0) {
      key = 'today'
      label = 'Today'
    } else if (daysAgo === 1) {
      key = 'yesterday'
      label = 'Yesterday'
    } else {
      key = created.toISOString().slice(0, 10)
      label = created.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    let group = byKey.get(key)
    if (!group) {
      group = { key, label, items: [] }
      byKey.set(key, group)
      groups.push(group)
    }
    group.items.push(item)
  }

  return groups
}
