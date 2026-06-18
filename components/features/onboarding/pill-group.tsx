'use client'

import { cn } from '@/lib/utils'
import { SELECT_SURFACE_SELECTED, SELECT_SURFACE_UNSELECTED } from '@/lib/onboarding-constants'

interface PillGroupProps {
  label: string
  options: readonly string[]
  value: string | null
  onChange: (value: string) => void
}

/** Single-select pill row (step 5 — agent count & ticket volume). */
export function PillGroup({ label, options, value, onChange }: PillGroupProps) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-medium text-foreground">{label}</legend>
      <div className="flex flex-wrap gap-2.5">
        {options.map((option) => {
          const selected = value === option
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              aria-pressed={selected}
              className={cn(
                'rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
                selected ? SELECT_SURFACE_SELECTED : SELECT_SURFACE_UNSELECTED,
              )}
            >
              {option}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
