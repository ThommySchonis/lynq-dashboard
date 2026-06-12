'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FloatField, type FloatFieldTone } from './float-field'
import {
  calcPasswordStrength,
  STRENGTH_COLORS,
  STRENGTH_LABELS,
  STRENGTH_BG_IDLE,
} from '@/lib/auth-constants'

interface PasswordFieldProps extends Omit<React.ComponentPropsWithoutRef<'input'>, 'type'> {
  label?: string
  error?: string
  showStrength?: boolean
  id?: string
  tone?: FloatFieldTone
}

const EYE_TONE: Record<FloatFieldTone, string> = {
  dark: 'text-white/40 hover:text-white/70 hover:bg-transparent focus-visible:ring-[#7F77DD]',
  light: 'text-foreground-4 hover:text-foreground hover:bg-transparent focus-visible:ring-primary',
}

const STRENGTH_LABEL_TONE: Record<FloatFieldTone, string> = {
  dark: 'text-white/55',
  light: 'text-foreground-3',
}

export function PasswordField({
  label = 'Password',
  error,
  showStrength = false,
  id,
  value,
  className,
  tone = 'dark',
  ...props
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  const passwordValue = typeof value === 'string' ? value : ''
  const score = showStrength ? calcPasswordStrength(passwordValue) : 0

  return (
    <div className="relative">
      <FloatField
        ref={undefined}
        id={id}
        label={label}
        error={error}
        tone={tone}
        type={visible ? 'text' : 'password'}
        value={value}
        className={cn('pr-11', className)}
        {...props}
      />
      <Button
        variant="ghost"
        size="icon-xs"
        type="button"
        aria-label={visible ? 'Hide password' : 'Show password'}
        onClick={() => setVisible(v => !v)}
        className={cn(
          'absolute right-3 top-[27px] -translate-y-1/2',
          EYE_TONE[tone],
          'focus-visible:ring-offset-transparent',
        )}
        tabIndex={0}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </Button>

      {showStrength && (
        <div className="mt-2 space-y-1">
          <div className="flex gap-1">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={cn(
                  'flex-1 h-[3px] rounded-sm transition-colors duration-200',
                  i < score ? STRENGTH_COLORS[score - 1] : STRENGTH_BG_IDLE,
                )}
              />
            ))}
          </div>
          {score > 0 && (
            <p className={cn('text-[11px] leading-none', STRENGTH_LABEL_TONE[tone])}>
              {STRENGTH_LABELS[score - 1]}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
