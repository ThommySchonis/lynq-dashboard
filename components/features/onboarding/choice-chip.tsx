'use client'

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChoiceChipProps {
  icon: LucideIcon
  label: string
  selected: boolean
  onSelect: () => void
}

/** Icon + label tile (step 6 — how did you hear about us). */
export function ChoiceChip({ icon: Icon, label, selected, onSelect }: ChoiceChipProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex items-center gap-2.5 rounded-lg border px-4 py-3 text-sm font-medium transition-colors',
        selected
          ? 'border-primary bg-accent-soft text-primary'
          : 'border-border bg-card text-foreground hover:border-border-hover',
      )}
    >
      <Icon className={cn('size-4', selected ? 'text-primary' : 'text-foreground-3')} />
      {label}
    </button>
  )
}
