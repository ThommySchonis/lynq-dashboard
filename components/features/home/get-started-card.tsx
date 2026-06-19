'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOnboardingChecklist, type ChecklistItem } from '@/hooks/home'
import { cn } from '@/lib/utils'

interface ChecklistRowProps {
  item: ChecklistItem
  index: number
  expanded: boolean
  onToggleExpand: () => void
  onMarkDone: (key: string, done: boolean) => void
}

function ChecklistRow({ item, index, expanded, onToggleExpand, onMarkDone }: ChecklistRowProps) {
  return (
    <div className="rounded-[12px] border border-border bg-card">
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
            item.done
              ? 'bg-success text-success-foreground'
              : 'bg-accent-soft text-primary',
          )}
        >
          {item.done ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
        </span>
        <span
          className={cn(
            'flex-1 text-sm font-medium',
            item.done ? 'text-foreground-4 line-through' : 'text-foreground',
          )}
        >
          {item.label}
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-foreground-4 transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-border px-4 py-3">
          <p className="text-[13px] leading-normal text-foreground-3">{item.description}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" nativeButton={false} render={<Link href={item.href} />}>
              {item.cta}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMarkDone(item.key, !item.done)}
            >
              {item.done ? 'Mark as not done' : 'Mark as done'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function GetStartedCard() {
  const { items, completed, total, allDone, toggleManual } = useOnboardingChecklist()
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  if (allDone) return null

  return (
    <section className="flex flex-col gap-[18px] rounded-2xl border border-border bg-card p-7 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Get started</h2>
          <p className="mt-0.5 text-[13px] text-foreground-3">
            A few things to get you up and running
          </p>
        </div>
        <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-primary">
          {completed}/{total} tasks
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {items.map((item, index) => (
          <ChecklistRow
            key={item.key}
            item={item}
            index={index}
            expanded={expandedKey === item.key}
            onToggleExpand={() =>
              setExpandedKey((prev) => (prev === item.key ? null : item.key))
            }
            onMarkDone={toggleManual}
          />
        ))}
      </div>
    </section>
  )
}
