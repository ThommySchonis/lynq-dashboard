'use client'

import { Check, ShieldCheck as ShieldSm } from 'lucide-react'
import { GUARANTEE_ITEMS } from '@/lib/services-constants'

export function GuaranteeBlock() {
  return (
    <div className="bg-[#F9F8FF] border border-black/[0.06] rounded-lg px-4 py-3.5 my-4">
      <div className="flex items-center gap-1.5 mb-2.5">
        <ShieldSm className="size-3 text-[#9B91A8] shrink-0" />
        <span className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-[.1em]">
          Our Guarantee
        </span>
      </div>
      {GUARANTEE_ITEMS.map((item) => (
        <div key={item} className="flex items-center gap-1.5 mb-1">
          <Check className="size-3 text-[#10B981] shrink-0" strokeWidth={2.5} />
          <span className="text-[12px] text-[#374151]">{item}</span>
        </div>
      ))}
    </div>
  )
}
