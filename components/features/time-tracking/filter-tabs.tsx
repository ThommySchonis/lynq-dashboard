'use client'

import { FILTERS } from '@/lib/time-tracking-constants'
import type { TimeFilter } from '@/types/time-tracking'

interface FilterTabsProps {
  filter: TimeFilter
  onChange: (filter: TimeFilter) => void
}

export function FilterTabs({ filter, onChange }: FilterTabsProps) {
  return (
    <div className="flex items-center gap-2">
      {FILTERS.map((f) => {
        const active = filter === f.id
        return (
          <button
            key={f.id}
            onClick={() => onChange(f.id)}
            className={`rounded-full border px-3.5 py-2 text-sm transition-colors ${
              active
                ? 'border-transparent bg-accent-soft font-semibold text-primary'
                : 'border-border bg-card font-medium text-foreground-3 hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        )
      })}
    </div>
  )
}
