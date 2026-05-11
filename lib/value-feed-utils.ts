export type FeedItemKind = 'tip' | 'masterclass' | 'update'

export const FILTERS: { id: 'all' | FeedItemKind; label: string }[] = [
  { id: 'all',         label: 'All'           },
  { id: 'tip',         label: 'Tips'          },
  { id: 'masterclass', label: 'Masterclasses' },
  { id: 'update',      label: 'Updates'       },
]

export interface FeedItem {
  id: string
  kind: FeedItemKind
  title: string
  body?: string | null
  created_at: string
  pinned?: boolean
  speaker_name?: string | null
  scheduled_at?: string | null
  zoom_url?: string | null
  youtube_url?: string | null
}

/**
 * Builds a Google Calendar "add event" URL for a masterclass.
 * @param title        Event title
 * @param start        ISO 8601 start datetime string
 * @param durationMinutes  Duration in minutes (default 60)
 */
export function googleCalUrl(title: string, start: string, durationMinutes: number = 60): string {
  const startDate = new Date(start)
  const endDate = new Date(startDate.getTime() + durationMinutes * 60_000)
  const fmt = (d: Date) => d.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'
  const p = new URLSearchParams({
    action:  'TEMPLATE',
    text:    title,
    details: '',
    dates:   `${fmt(startDate)}/${fmt(endDate)}`,
    location: '',
  })
  return `https://calendar.google.com/calendar/render?${p}`
}

/**
 * Returns the uppercased initials (max 2) from a full name.
 */
export function initialsOf(name: string): string {
  if (!name) return ''
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map(p => p[0]).join('').toUpperCase()
}

/**
 * Maps a broadcast DB row to a FeedItemKind.
 * type='update' → 'update'; everything else → 'tip'.
 */
export function classifyBroadcast(broadcast: Record<string, unknown>): FeedItemKind {
  return broadcast['type'] === 'update' ? 'update' : 'tip'
}
