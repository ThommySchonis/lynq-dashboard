import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'

interface SettingsFieldProps {
  label?: string
  hint?: string
  error?: string
  htmlFor?: string
  /** Render the label at 600 weight (Figma AI-onboarding "Strong" labels). */
  emphasizeLabel?: boolean
  children: ReactNode
}

export function SettingsField({ label, hint, error, htmlFor, emphasizeLabel, children }: SettingsFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <Label
          htmlFor={htmlFor}
          className={`text-sm text-foreground ${emphasizeLabel ? 'font-semibold' : 'font-medium'}`}
        >
          {label}
        </Label>
      )}
      {children}
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
