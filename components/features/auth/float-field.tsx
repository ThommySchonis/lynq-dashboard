'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export type FloatFieldTone = 'dark' | 'light'

interface FloatFieldProps extends Omit<React.ComponentPropsWithoutRef<'input'>, 'placeholder'> {
  label: string
  error?: string
  tone?: FloatFieldTone
}

const INPUT_TONE: Record<FloatFieldTone, string> = {
  dark: cn(
    'float-field',
    'bg-white/[0.06] border-white/[0.12] text-white/95',
    'placeholder:text-white/40',
    'hover:bg-white/[0.075]',
    'focus:border-[#7F77DD] focus:bg-white/10',
    'focus:[box-shadow:0_0_0_4px_rgba(127,119,221,0.15),0_0_20px_rgba(127,119,221,0.20)]',
  ),
  light: cn(
    'float-field-light',
    'bg-secondary border-[#E5E0EB] text-foreground',
    'placeholder:text-foreground-4',
    'hover:bg-secondary/70',
    'focus:border-primary focus:bg-white',
    'focus:[box-shadow:0_0_0_4px_rgba(161,117,252,0.15)]',
  ),
}

const LABEL_TONE: Record<FloatFieldTone, string> = {
  dark: cn(
    'text-white/40',
    'peer-focus:text-[#C4B0FF]',
    'peer-[:not(:placeholder-shown)]:text-white/60',
  ),
  light: cn(
    'text-foreground-4',
    'peer-focus:text-primary',
    'peer-[:not(:placeholder-shown)]:text-foreground-3',
  ),
}

const LABEL_ERROR_TONE: Record<FloatFieldTone, string> = {
  dark: 'text-red-400/70',
  light: 'text-red-600/80',
}

const ERROR_TEXT_TONE: Record<FloatFieldTone, string> = {
  dark: 'text-red-400',
  light: 'text-red-600',
}

export const FloatField = forwardRef<HTMLInputElement, FloatFieldProps>(
  function FloatField({ label, error, className, id, tone = 'dark', ...props }, ref) {
    return (
      <div className="relative">
        <input
          ref={ref}
          id={id}
          placeholder=" "
          aria-invalid={error ? true : undefined}
          aria-describedby={error && id ? `${id}-error` : undefined}
          className={cn(
            'peer w-full h-[54px] box-border',
            'pt-5 pb-1.5 px-7',
            'border rounded-xl',
            'text-[15px]',
            'outline-none transition-[border-color,box-shadow,background-color] duration-200 ease-[ease]',
            INPUT_TONE[tone],
            error && 'border-red-500/70 focus:border-red-500 focus:[box-shadow:0_0_0_4px_rgba(239,68,68,0.15)]',
            className,
          )}
          {...props}
        />
        <label
          htmlFor={id}
          className={cn(
            'float-label',
            // Horizontal anchor matches the input's pl-7 (28px) exactly so
            // resting + floated label and typed text share the same left
            // edge. NO transforms — the previous dual-system (globals.css
            // translateY + scale plus Tailwind top/font/tracking changes)
            // caused the floated label to render outside the input box and
            // appear horizontally mis-aligned.
            'absolute left-7 top-4',
            'text-sm pointer-events-none',
            'transition-[top,font-size,color] duration-[180ms] ease-[ease]',
            'peer-focus:top-1.5 peer-focus:text-[11px]',
            'peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-[11px]',
            LABEL_TONE[tone],
            error && LABEL_ERROR_TONE[tone],
          )}
        >
          {label}
        </label>
        {error && (
          <p
            id={id ? `${id}-error` : undefined}
            role="alert"
            className={cn('mt-1.5 px-1 text-xs', ERROR_TEXT_TONE[tone])}
          >
            {error}
          </p>
        )}
      </div>
    )
  }
)
