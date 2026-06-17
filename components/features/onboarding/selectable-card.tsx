'use client'

import { cn } from '@/lib/utils'

interface SelectableCardProps {
  /** Illustration SVG URL served from /public. */
  icon: string
  title: string
  description: string
  selected: boolean
  onSelect: () => void
}

/** Goal-objective card (step 1). Single-select, highlights when chosen. */
export function SelectableCard({ icon, title, description, selected, onSelect }: SelectableCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex flex-1 flex-col gap-2.5 rounded-[14px] border px-5 py-[18px] text-left transition-colors',
        selected
          ? 'border-accent-border bg-accent-soft'
          : 'border-border bg-card hover:border-border-hover',
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex-1 text-sm font-medium text-foreground">{title}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon} alt="" className="size-12 shrink-0" />
      </div>
      <p className="text-sm leading-relaxed text-foreground-3">{description}</p>
    </button>
  )
}
