'use client'

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectableCardProps {
  icon: LucideIcon
  title: string
  description: string
  selected: boolean
  onSelect: () => void
}

/** Goal-objective card (step 1). Single-select, highlights when chosen. */
export function SelectableCard({ icon: Icon, title, description, selected, onSelect }: SelectableCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex flex-1 flex-col gap-3 rounded-[14px] border p-4 text-left transition-colors',
        selected
          ? 'border-primary bg-accent-soft'
          : 'border-border bg-card hover:border-border-hover',
      )}
    >
      <div
        className={cn(
          'flex size-9 items-center justify-center rounded-lg',
          selected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-primary',
        )}
      >
        <Icon className="size-5" />
      </div>
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <div className="text-xs leading-relaxed text-foreground-3">{description}</div>
    </button>
  )
}
