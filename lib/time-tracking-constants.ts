/**
 * Shared constants for the Time Tracking module.
 * Extracted from app/time-tracking/page.js.
 */

import type { Session, TimeFilter, TeamKpiDef } from '@/types/time-tracking'

// ── Filter presets ───────────────────────────────────────────────────────────

export const FILTERS: { id: TimeFilter; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
]

// Nominal shift length used only to scale the header timer's progress bar.
// Not a backend value — see B10 in the backend backlog.
export const SHIFT_TARGET_SEC = 8 * 3600

// ── KPI definitions ──────────────────────────────────────────────────────────

export const TEAM_KPI: TeamKpiDef[] = [
  { key: 'active', label: 'ACTIVE NOW' },
  { key: 'break', label: 'ON BREAK' },
  { key: 'total', label: 'TOTAL HOURS' },
  { key: 'team', label: 'TEAM SIZE' },
]

export const EMP_KPI: TeamKpiDef[] = [
  { key: 'week', label: null },
  { key: 'today', label: 'TODAY' },
  { key: 'avg', label: 'AVG PER DAY' },
]

// ── Formatters ───────────────────────────────────────────────────────────────

export function fmtElapsed(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function fmtDur(sec: number): string {
  if (!sec || sec <= 0) return '\u2014'
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  if (h === 0) return `${m}m`
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function durSec(s: Session): number {
  if (s.clocked_out_at) return Math.round((new Date(s.clocked_out_at).getTime() - new Date(s.clocked_in_at).getTime()) / 1000)
  return (s.active_seconds || 0) + (s.idle_seconds || 0)
}

export function fmtTime(iso: string): string {
  if (!iso) return '\u2014'
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function fmtDate(iso: string): string {
  if (!iso) return '\u2014'
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
