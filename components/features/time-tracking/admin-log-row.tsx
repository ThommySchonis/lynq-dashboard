'use client'

import { fmtDate, fmtTime, fmtDur, durSec } from '@/lib/time-tracking-constants'
import type { Session } from '@/types/time-tracking'

interface AdminLogRowProps {
  session: Session
}

export function AdminLogRow({ session: s }: AdminLogRowProps) {
  return (
    <div className="grid cursor-default grid-cols-[130px_110px_60px_60px_70px_1fr] items-start gap-3 border-b border-black/5 px-4.5 py-2.5 transition-colors last:border-b-0 hover:bg-background">
      <div className="truncate text-[12.5px] font-semibold text-foreground">{s.member_name}</div>
      <div className="text-[12.5px] text-gray-500">{fmtDate(s.clocked_in_at)}</div>
      <div className="text-[12.5px] text-gray-500 tabular-nums">{fmtTime(s.clocked_in_at)}</div>
      <div className={`text-[12.5px] tabular-nums ${s.clocked_out_at ? 'text-gray-500' : 'text-emerald-600'}`}>
        {s.clocked_out_at ? fmtTime(s.clocked_out_at) : 'Active'}
      </div>
      <div className="text-[13px] font-semibold text-foreground tabular-nums">{fmtDur(durSec(s))}</div>
      <div className="line-clamp-2 text-[12.5px] leading-relaxed text-gray-500">
        {s.eod_report || <span className="italic text-gray-300">No report</span>}
      </div>
    </div>
  )
}
