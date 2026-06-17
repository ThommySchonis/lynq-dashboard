'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Mail, KeyRound, Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { WizardShell } from '../wizard-shell'
import { ProgressFooter } from '../progress-footer'
import { StepHeading } from '../step-heading'
import { accountSchema } from '@/lib/onboarding-constants'
import type { AccountFormData } from '@/lib/onboarding-constants'

interface StepAccountProps {
  stepIndex: number
  defaultValues: AccountFormData
  onBack: () => void
  onNext: (values: AccountFormData) => void
}

export function StepAccount({ stepIndex, defaultValues, onBack, onNext }: StepAccountProps) {
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues,
    mode: 'onChange',
  })

  return (
    <WizardShell
      footer={
        <ProgressFooter
          stepIndex={stepIndex}
          onBack={onBack}
          onNext={() => void handleSubmit(onNext)()}
          nextLabel="Create account"
          nextDisabled={!isValid}
        />
      }
    >
      <form className="flex flex-col gap-6" onSubmit={(e) => void handleSubmit(onNext)(e)}>
        <StepHeading
          title="Set up your account"
          description="Provide your email and choose a password to begin."
        />

        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Work email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-3" />
            <Input
              id="email"
              type="email"
              {...register('email')}
              placeholder="e.g., user_email@gmail.com"
              className="h-11 pl-10"
            />
          </div>
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            Password
          </label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-3" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              {...register('password')}
              placeholder="Create your Password"
              className="h-11 px-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-3 transition-colors hover:text-foreground"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <p className="text-xs text-foreground-3">
            At least 6 characters, incl. uppercase, lowercase, number &amp; symbol.
          </p>
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <p className="text-xs leading-relaxed text-foreground-3">
          By proceeding, you agree to the{' '}
          <a href="/terms" className="text-foreground-3 underline">
            Terms and Conditions
          </a>{' '}
          and{' '}
          <a href="/privacy" className="text-foreground-3 underline">
            Privacy Policy
          </a>
          .
        </p>
      </form>
    </WizardShell>
  )
}
