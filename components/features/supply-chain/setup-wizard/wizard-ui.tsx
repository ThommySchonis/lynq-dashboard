'use client'

/** Shared primitives for the Parcel Panel setup wizard. */

/** Centered step heading: numbered badge + title + subtitle. */
export function StepHeader({ step, title, subtitle }: { step: number; title: string; subtitle: string }) {
  return (
    <>
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-primary">
        {step}
      </div>
      <h2 className="text-center text-lg font-bold tracking-[-0.01em] text-foreground">{title}</h2>
      <p className="max-w-[460px] text-center text-sm font-medium text-foreground-3">{subtitle}</p>
    </>
  )
}

/** Uppercase section label flanked by hairline rules. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full items-center gap-3.5">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground-4">{children}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}

/** Pill toggle (38×22). Visual-only unless wired by the caller. */
export function Toggle({
  checked,
  onChange,
  'aria-label': ariaLabel,
}: {
  checked: boolean
  onChange?: () => void
  'aria-label'?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onChange}
      className={`flex h-[22px] w-[38px] shrink-0 items-center rounded-full px-[3px] transition-colors ${
        checked ? 'justify-end bg-primary' : 'justify-start bg-toggle-off'
      }`}
    >
      <span className="h-4 w-4 rounded-full bg-card" />
    </button>
  )
}
