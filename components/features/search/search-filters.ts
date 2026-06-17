// Filter model shared by the search dialog and the global-search hook.
// The wire-format (comma-joined query params) mirrors the backend
// parseFilterParams contract in supabase/functions/api/lib/services/search.ts.

export type StatusFilterValue = 'open' | 'pending' | 'resolved' | 'ai_staged' | 'spam'
export type DatePreset = 'today' | 'last7' | 'last30' | 'custom'

export interface SearchFilters {
  status: StatusFilterValue[]
  assignee: string[] // workspace_members.id values, plus the 'unassigned' sentinel
  dateFrom: string | null
  dateTo: string | null
}

export const STATUS_OPTIONS: { value: StatusFilterValue; label: string }[] = [
  { value: 'open',      label: 'Open' },
  { value: 'pending',   label: 'Pending' },
  { value: 'resolved',  label: 'Resolved' },
  { value: 'ai_staged', label: 'AI Staged' },
  { value: 'spam',      label: 'Spam' },
]

export const DATE_PRESETS: { value: Exclude<DatePreset, 'custom'>; label: string }[] = [
  { value: 'today',  label: 'Today' },
  { value: 'last7',  label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
]

export const UNASSIGNED = 'unassigned'

export function emptyFilters(): SearchFilters {
  return { status: [], assignee: [], dateFrom: null, dateTo: null }
}

export function hasActiveFilters(f: SearchFilters): boolean {
  return f.status.length > 0 || f.assignee.length > 0 || f.dateFrom !== null || f.dateTo !== null
}

export function activeFilterCount(f: SearchFilters): number {
  return f.status.length + f.assignee.length + (f.dateFrom !== null || f.dateTo !== null ? 1 : 0)
}

// Returns the query params to append to /search. Omits empty values so the
// queryKey/cache stays stable for "no filter" searches.
export function serializeFilters(f: SearchFilters): Record<string, string> {
  const out: Record<string, string> = {}
  if (f.status.length) out.status = f.status.join(',')
  if (f.assignee.length) out.assignee = f.assignee.join(',')
  if (f.dateFrom) out.dateFrom = f.dateFrom
  if (f.dateTo) out.dateTo = f.dateTo
  return out
}

// Stable string for use in a TanStack queryKey.
export function filtersKey(f: SearchFilters): string {
  return JSON.stringify({
    status: [...f.status].sort(),
    assignee: [...f.assignee].sort(),
    dateFrom: f.dateFrom,
    dateTo: f.dateTo,
  })
}

// Compute an ISO date range for a preset. 'custom' returns nulls — the caller
// supplies dateFrom/dateTo directly from a date picker.
export function presetToRange(preset: DatePreset): { dateFrom: string | null; dateTo: string | null } {
  if (preset === 'custom') return { dateFrom: null, dateTo: null }
  const now = new Date()
  const to = now.toISOString()
  const start = new Date(now)
  if (preset === 'today') {
    start.setHours(0, 0, 0, 0)
  } else if (preset === 'last7') {
    start.setDate(start.getDate() - 7)
  } else if (preset === 'last30') {
    start.setDate(start.getDate() - 30)
  }
  return { dateFrom: start.toISOString(), dateTo: to }
}
