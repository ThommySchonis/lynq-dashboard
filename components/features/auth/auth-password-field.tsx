'use client'

import { useId, useState, type ReactNode } from 'react'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AuthPasswordFieldProps
  extends Omit<React.ComponentPropsWithoutRef<'input'>, 'id' | 'type'> {
  label: string
  /** Right-aligned action in the label row (e.g. a "Forgot password?" link) */
  labelAction?: ReactNode
  /** Leading icon (defaults to a key) */
  icon?: ReactNode
  helper?: string
  error?: string
  id?: string
}

/**
 * Labeled password input with a leading key icon and a trailing eye toggle,
 * matching the Figma auth design.
 */
export function AuthPasswordField({
  label,
  labelAction,
  icon = <KeyRound size={18} />,
  helper,
  error,
  id,
  className,
  ...props
}: AuthPasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  const generatedId = useId()
  const inputId = id ?? generatedId
  const describedById = error || helper ? `${inputId}-desc` : undefined

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-foreground"
        >
          {label}
        </label>
        {labelAction}
      </div>
      <div className="flex h-11 items-center gap-2.5 rounded-[10px] border border-input-strong bg-card px-3 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedById}
          className={cn(
            'flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground',
            className,
          )}
          {...props}
        />
        <button
          type="button"
          aria-label={visible ? 'Hide password' : 'Show password'}
          onClick={() => setVisible((v) => !v)}
          className="shrink-0 text-foreground-4 transition-colors hover:text-foreground"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {(error || helper) && (
        <p
          id={describedById}
          role={error ? 'alert' : undefined}
          className={cn('text-xs', error ? 'text-destructive' : 'text-foreground-3')}
        >
          {error ?? helper}
        </p>
      )}
    </div>
  )
}
