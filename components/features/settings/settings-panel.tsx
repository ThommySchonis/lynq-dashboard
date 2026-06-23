import type { ReactNode } from 'react'

/**
 * Settings card matching the Figma redesign (node 776-17460):
 * white surface, 1px border, 16px radius. A title/description header sits
 * inside the card, followed by label-left / control-right rows separated by
 * full-width dividers.
 *
 * Use `SettingsPanel` as the card and `SettingsRow` for each field. The older
 * `SettingsSection` / `SettingsCard` / `SettingsField` remain for settings
 * pages not yet migrated to the new design.
 */

interface SettingsPanelProps {
  title: string
  description?: string
  /** One or more <SettingsRow> */
  children: ReactNode
  className?: string
}

export function SettingsPanel({ title, description, children, className }: SettingsPanelProps) {
  return (
    <div
      className={`bg-card border border-border rounded-2xl px-[22px] pb-2 divide-y divide-border ${className ?? ''}`}
    >
      <div className="pt-5 pb-3.5">
        <h3 className="text-base font-semibold text-foreground leading-snug">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}

interface SettingsRowProps {
  label: string
  hint?: string
  error?: string
  htmlFor?: string
  /** The control (input, select, switch, button…) shown on the right */
  children: ReactNode
  /** Align the control to the label's vertical center (default) or its top */
  align?: 'center' | 'start'
}

export function SettingsRow({
  label,
  hint,
  error,
  htmlFor,
  children,
  align = 'center',
}: SettingsRowProps) {
  return (
    <div
      className={`flex ${align === 'center' ? 'items-center' : 'items-start'} justify-between gap-6 py-[15px]`}
    >
      <div className="flex flex-col gap-[3px] min-w-0">
        <label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">
          {label}
        </label>
        {hint && !error && (
          <p className="text-xs text-muted-foreground leading-relaxed">{hint}</p>
        )}
        {error && <p className="text-xs text-destructive leading-relaxed">{error}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
