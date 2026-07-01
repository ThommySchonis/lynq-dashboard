'use client'

import { FILTERS } from '@/lib/value-feed-utils'
import type { FilterId } from '@/lib/value-feed-utils'

interface FilterTabsProps {
  active: FilterId
  counts: Record<FilterId, number>
  onChange: (id: FilterId) => void
}

/**
 * Value Feed filter pills (Figma "Tabs" node 403:793).
 * Active pill = accent-soft + primary; inactive = white + border.
 */
export function FilterTabs({ active, counts, onChange }: FilterTabsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {FILTERS.map((f) => {
        const isActive = active === f.id
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onChange(f.id)}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 text-sm transition-colors ${
              isActive
                ? 'bg-accent-soft font-semibold text-primary'
                : 'border border-border bg-card font-medium text-foreground-3 hover:text-foreground'
            }`}
          >
            {f.label}
            <span className={`text-sm tabular-nums ${isActive ? 'text-primary' : 'text-foreground-4'}`}>
              {counts[f.id] ?? 0}
            </span>
          </button>
        )
      })}
    </div>
  )
}
