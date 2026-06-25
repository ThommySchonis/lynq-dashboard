'use client'

import type { ReactNode } from 'react'

/** Default email accent colour (matches the brand primary) — seeds EMPTY_FORM. */
export const DEFAULT_ACCENT_COLOR = '#7C3AED'

/** Shared text-input styling for the email-display fields (Figma EL-452ac71f). */
export const INPUT_CLASS =
  'w-full rounded-[10px] border border-settings-border bg-card px-3.5 py-[11px] text-sm text-foreground placeholder:text-foreground-4 outline-none transition-colors focus:border-primary'

/**
 * Section card shell for the Email Display form (Figma node 984-52/77/108/131).
 * White card, 1px settings border, radius 16, 22px padding; title (16/600) +
 * optional description (14/500 muted), then an 18px gap before the body.
 */
export function EmailDisplayCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-settings-border bg-card p-[22px]">
      <div className="flex flex-col gap-[3px]">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && <p className="text-sm font-medium text-foreground-3">{description}</p>}
      </div>
      <div className="mt-[18px] flex flex-col">{children}</div>
    </section>
  )
}

/** A label + control field stack (Figma "From name" etc. — label 14/600, 7px gap). */
export function EmailDisplayField({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-[7px]">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}

/**
 * Toggle row with a leading top divider (Figma EL-2f24ed9d): border-top + 16px
 * top padding, label/description on the left, control on the right.
 */
export function EmailDisplayToggleRow({
  title,
  description,
  control,
  divided = true,
}: {
  title: string
  description?: string
  control: ReactNode
  divided?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 ${divided ? 'mt-4 border-t border-settings-border pt-4' : ''}`}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {description && <span className="text-xs font-medium text-foreground-3">{description}</span>}
      </div>
      {control}
    </div>
  )
}
