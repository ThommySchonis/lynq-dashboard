'use client'

import { ArrowRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AuthSubmitButtonProps
  extends React.ComponentPropsWithoutRef<'button'> {
  /** Whether the action is in flight (shows a spinner, disables the button) */
  pending?: boolean
  /** Label shown while pending (defaults to the children) */
  pendingLabel?: string
}

/** Full-width primary submit button used across the auth screens. */
export function AuthSubmitButton({
  pending = false,
  pendingLabel,
  children,
  disabled,
  className,
  ...props
}: AuthSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={cn(
        'flex h-11 w-full items-center justify-center gap-1.5 rounded-[10px] bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    >
      {pending ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          {pendingLabel ?? children}
        </>
      ) : (
        <>
          {children}
          <ArrowRight size={16} />
        </>
      )}
    </button>
  )
}
