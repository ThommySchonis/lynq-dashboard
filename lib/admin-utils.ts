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

export function exportTimeCSV(sessions: TimeSession[]): void {
  const rows = sessions.map((s) => [
    s.member_name,
    fmtD(s.clocked_in_at),
    fmtT(s.clocked_in_at),
    s.clocked_out_at ? fmtT(s.clocked_out_at) : 'Active',
    (workedSec(s) / 3600).toFixed(2),
    ((s.paused_seconds || 0) / 3600).toFixed(2),
    (s.eod_report || '').replace(/"/g, '""'),
  ])
  const header = 'Name,Date,Clock In,Clock Out,Worked (h),Break (h),Report'
  const csv = [header, ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `time-export-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
