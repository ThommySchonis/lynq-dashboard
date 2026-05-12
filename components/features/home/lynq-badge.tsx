'use client'

import { Layers } from 'lucide-react'

export function LynqBadge() {
  return (
    <div className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-primary to-violet-600 shadow-[0_2px_8px_rgba(161,117,252,0.4)]">
      <Layers className="size-3.5 text-white" strokeWidth={2.2} />
    </div>
  )
}
