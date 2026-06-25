'use client'

import type { ReactNode } from 'react'

/** Shared input styling for the macro wizard (Figma node 820-16: radius 10, ~12/14 padding). */
export const WIZARD_INPUT_CLASS = 'h-11 rounded-[10px] bg-card px-3.5 text-sm'

interface WizardFieldProps {
  label: string
  hint?: string
  error?: string
  htmlFor?: string
  children: ReactNode
}

export function WizardField({ label, hint, error, htmlFor, children }: WizardFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

interface WizardOptionCardProps {
  selected: boolean
  title: string
  desc?: string
  onClick: () => void
}

/** Radio-style option card (Figma: radius 12, selected = accent-soft + primary border). */
export function WizardOptionCard({ selected, title, desc, onClick }: WizardOptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex w-full items-center gap-3 rounded-xl border-[1.6px] px-4 py-3.5 text-left transition-colors',
        selected ? 'border-primary bg-accent-soft' : 'border-border hover:border-border-hover',
      ].join(' ')}
    >
      <span
        className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
          selected ? 'border-primary' : 'border-muted-foreground/40'
        }`}
      >
        {selected && <span className="size-2 rounded-full bg-primary" />}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {desc && <span className="text-xs text-muted-foreground">{desc}</span>}
      </span>
    </button>
  )
}
