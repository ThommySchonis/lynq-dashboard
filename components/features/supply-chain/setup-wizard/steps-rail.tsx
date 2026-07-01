'use client'

import { Check, ChevronRight } from 'lucide-react'
import { SETUP_STEPS } from '@/lib/supply-chain-constants'

type StepState = 'done' | 'active' | 'pending'

function RailItem({
  index,
  label,
  state,
  onClick,
}: {
  index: number
  label: string
  state: StepState
  onClick: () => void
}) {
  if (state === 'active') {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-[12px] border border-border bg-card px-3 py-[11px] text-left shadow-[0_4px_12px_-4px_rgba(15,13,31,0.08)]"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-primary">
          {index + 1}
        </span>
        <span className="flex-1 text-sm font-medium text-primary">{label}</span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-foreground-4" />
      </button>
    )
  }

  const done = state === 'done'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!done}
      className="flex w-full items-center gap-3 rounded-[12px] px-3 py-[11px] text-left disabled:cursor-default"
    >
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
          done ? 'bg-success-soft text-success' : 'bg-card text-foreground-4'
        }`}
      >
        {done ? <Check className="h-3 w-3" /> : index + 1}
      </span>
      <span className={`flex-1 text-sm font-medium ${done ? 'text-success' : 'text-foreground-3'}`}>{label}</span>
    </button>
  )
}

export function StepsRail({ current, onSelect }: { current: number; onSelect: (index: number) => void }) {
  return (
    <aside className="w-[279px] shrink-0 bg-surface-rail px-6 pl-7 py-[34px]">
      <p className="mb-5 text-xs font-semibold uppercase tracking-[0.08em] text-foreground-4">Setup steps</p>
      <div className="flex flex-col gap-1.5">
        {SETUP_STEPS.map((s, i) => (
          <RailItem
            key={s.key}
            index={i}
            label={s.label}
            state={i < current ? 'done' : i === current ? 'active' : 'pending'}
            onClick={() => i <= current && onSelect(i)}
          />
        ))}
      </div>
    </aside>
  )
}
