'use client'

import { Sparkles } from 'lucide-react'

export function AutoSentBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-full px-2 py-0.5">
      <Sparkles size={10} />
      Auto-sent by Emma
    </span>
  )
}
