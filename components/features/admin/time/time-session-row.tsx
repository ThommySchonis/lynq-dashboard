'use client'

import type { TimeSession } from '@/types/admin'
import { fmtT, fmtD, fmtSec, workedSec } from '@/lib/admin-utils'

interface TimeSessionRowProps {
  session: TimeSession
}

export function TimeSessionRow({ session: s }: TimeSessionRowProps) {
  const wSec = workedSec(s)
  const hrs = wSec > 0 ? (wSec / 3600).toFixed(2) : s.clocked_out_at ? '0.00' : '\u2014'
  const brk = s.paused_seconds > 0 ? fmtSec(s.paused_seconds) : '\u2014'

  return (
    <div className="grid grid-cols-[140px_110px_65px_65px_70px_60px_1fr] items-start gap-2.5 border-b border-border/20 py-2.5">
      <div>
        <div className="text-[12.5px] font-medium text-foreground">{s.member_name}</div>
        <div className="mt-px text-[11px] text-muted-foreground">{s.member_email}</div>
      </div>
      <div className="text-[12.5px] text-muted-foreground">{fmtD(s.clocked_in_at)}</div>
      <div className="text-[12.5px] tabular-nums text-muted-foreground">{fmtT(s.clocked_in_at)}</div>
      <div className={`text-[12.5px] tabular-nums ${s.clocked_out_at ? 'text-muted-foreground' : 'text-emerald-600'}`}>
        {s.clocked_out_at ? fmtT(s.clocked_out_at) : 'Active'}
      </div>
      <div className="text-[12.5px] font-semibold text-foreground">{hrs}h</div>
      <div className={`text-[12.5px] ${s.paused_seconds > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
        {brk}
      </div>
      <div className="break-words text-xs leading-[1.45] text-muted-foreground">
        {s.eod_report || <span className="italic text-muted-foreground/60">No report</span>}
      </div>
    </div>
  )
}
