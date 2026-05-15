'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface FloatFieldProps extends Omit<React.ComponentPropsWithoutRef<'input'>, 'placeholder'> {
  label: string
  error?: string
}

export const FloatField = forwardRef<HTMLInputElement, FloatFieldProps>(
  function FloatField({ label, error, className, id, ...props }, ref) {
    return (
      <div className="relative">
        <input
          ref={ref}
          id={id}
          placeholder=" "
          aria-invalid={error ? true : undefined}
          aria-describedby={error && id ? `${id}-error` : undefined}
          className={cn(
            'float-field',
            'peer w-full h-[54px] box-border',
            'pt-5 pb-1.5 px-7',
            'bg-white/[0.06] border border-white/[0.12] rounded-xl',
            'text-[15px] text-white/95',
            'outline-none transition-[border-color,box-shadow,background-color] duration-200 ease-[ease]',
            'placeholder:text-white/40',
            'hover:bg-white/[0.075]',
            'focus:border-[#7F77DD] focus:bg-white/10',
            'focus:[box-shadow:0_0_0_4px_rgba(127,119,221,0.15),0_0_20px_rgba(127,119,221,0.20)]',
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
            'text-sm text-white/40',
            'pointer-events-none',
            'transition-[top,font-size,color] duration-[180ms] ease-[ease]',
            // Floated state: sits INSIDE the input at the top, smaller font.
            // Material-style inset label — no scale, no tracking change.
            'peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:text-[#C4B0FF]',
            'peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:text-white/60',
            error && 'text-red-400/70',
          )}
        >
          {label}
        </label>
        {error && (
          <p
            id={id ? `${id}-error` : undefined}
            role="alert"
            className="mt-1.5 px-1 text-xs text-red-400"
          >
            {error}
          </p>
        )}
      </div>
    )
  }
)
