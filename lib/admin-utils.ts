import type { TimeSession } from '@/types/admin'

export function fmtSec(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

export function fmtT(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function fmtD(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function fmtDT(iso: string): string {
  return `${fmtD(iso)} ${fmtT(iso)}`
}

export function workedSec(s: TimeSession): number {
  const end = s.clocked_out_at ? new Date(s.clocked_out_at).getTime() : Date.now()
  const start = new Date(s.clocked_in_at).getTime()
  return Math.max(0, Math.floor((end - start) / 1000) - (s.paused_seconds || 0))
}

export function fmtUsd(n: number): string {
  return `$${n.toFixed(4)}`
}

export function fmtEur(n: number): string {
  return `€${Math.round(n)}`
}

export function fmtNum(n: number): string {
  return n.toLocaleString()
}

export function isPast(iso: string): boolean {
  return new Date(iso).getTime() < Date.now()
}

export function getYoutubeId(url: string | null): string | null {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

// CSV-quote helper — doubles internal quotes per RFC 4180.
function csvSafe(value: string | number | null | undefined): string {
  if (value == null) return ''
  return String(value).replace(/"/g, '""')
}

export function exportTimeCSV(sessions: TimeSession[]): void {
  // Columns split the new structured fields out of the legacy `Report`
  // column. Old sessions that pre-date the EOD migration land their
  // free text in the trailing "Legacy report" column; new sessions
  // leave that empty and populate the three structured columns.
  const rows = sessions.map((s) => [
    csvSafe(s.member_name),
    csvSafe(fmtD(s.clocked_in_at)),
    csvSafe(fmtT(s.clocked_in_at)),
    csvSafe(s.clocked_out_at ? fmtT(s.clocked_out_at) : 'Active'),
    (workedSec(s) / 3600).toFixed(2),
    ((s.paused_seconds || 0) / 3600).toFixed(2),
    csvSafe(s.emails_answered),
    csvSafe(s.what_went_well),
    csvSafe(s.needs_attention),
    csvSafe(s.eod_report),
  ])
  const header =
    'Name,Date,Clock In,Clock Out,Worked (h),Break (h),Emails Answered,What Went Well,Needs Attention,Legacy Report'
  const csv = [header, ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `time-export-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
