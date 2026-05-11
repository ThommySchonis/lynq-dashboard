'use client'

import { getStatus } from '@/lib/supply-chain-constants'

export function StatusBadge({ status }: { status: string }) {
  const s = getStatus(status)
  return (
    <span
      className="inline-flex items-center gap-[5px] px-2.5 py-[3px] rounded-full text-[11px] font-bold whitespace-nowrap"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
    >
      <span
        className="w-[5px] h-[5px] rounded-full shrink-0"
        style={{ background: s.color }}
      />
      {s.label}
    </span>
  )
}
