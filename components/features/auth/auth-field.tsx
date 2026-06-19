'use client'

import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface AuthFieldProps
  extends Omit<React.ComponentPropsWithoutRef<'input'>, 'id'> {
  label: string
  /** Leading icon (e.g. <Mail size={18} />) */
  icon?: ReactNode
  helper?: string
  error?: string
  id?: string
}

/**
 * Labeled text input with a leading icon, matching the Figma auth design
 * (label above, bordered input, optional helper/error below).
 */
export function AuthField({
  label,
  icon,
  helper,
  error,
  id,
  className,
  ...props
}: AuthFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const describedById = error || helper ? `${inputId}-desc` : undefined

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-foreground"
      >
        {label}
      </label>
      <div className="flex h-11 items-center gap-2.5 rounded-[10px] border border-input-strong bg-card px-3 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
        {icon && (
          <span className="shrink-0 text-muted-foreground">{icon}</span>
        )}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedById}
          className={cn(
            'flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground',
            className,
          )}
          {...props}
        />
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
