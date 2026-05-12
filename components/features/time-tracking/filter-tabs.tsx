'use client'

import { FILTERS } from '@/lib/time-tracking-constants'
import type { TimeFilter } from '@/types/time-tracking'

interface FilterTabsProps {
  filter: TimeFilter
  onChange: (filter: TimeFilter) => void
}

export function FilterTabs({ filter, onChange }: FilterTabsProps) {
  return (
    <div className="inline-flex gap-0.5 rounded-lg border border-black/8 bg-white p-[3px]">
      {FILTERS.map(f => (
        <button
          key={f.id}
          className={`rounded-md px-3.5 py-1 text-xs font-semibold transition-all ${
            filter === f.id
              ? 'bg-[#0F0F10] text-white'
              : 'bg-transparent text-gray-500 hover:bg-black/4 hover:text-foreground'
          }`}
          onClick={() => onChange(f.id)}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}
