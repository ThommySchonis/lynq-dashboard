'use client'

import { useState } from 'react'
import AuthLayout from '@/components/features/auth/auth-layout'
import { FloatField } from '@/components/features/auth/float-field'
import { PasswordField } from '@/components/features/auth/password-field'
import { TrustItem } from '@/components/features/auth/trust-item'
import { VerifyPanel } from '@/components/features/auth/verify-panel'
import { HeadlineWords } from '@/components/features/auth/headline-words'
import { LegalAcceptance } from '@/components/features/auth/legal-acceptance'
import { useSignUp } from '@/hooks/auth/use-auth-mutations'
import { TRUST_ITEMS } from '@/lib/auth-constants'

const NAME_MAX = 50
const COMPANY_MIN = 2
const COMPANY_MAX = 100
const PASSWORD_MIN = 8

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [password, setPassword] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [pending, setPending] = useState<'verify' | null>(null)

  const signUp = useSignUp()

  function validate(): string | null {
    if (!firstName.trim() || firstName.trim().length > NAME_MAX) {
      return 'First name is required (max 50 characters)'
    }
    if (!lastName.trim() || lastName.trim().length > NAME_MAX) {
      return 'Last name is required (max 50 characters)'
    }
    const company = companyName.trim()
    if (company.length < COMPANY_MIN || company.length > COMPANY_MAX) {
      return `Company name must be between ${COMPANY_MIN} and ${COMPANY_MAX} characters`
    }
    if (password.length < PASSWORD_MIN) {
      return `Password must be at least ${PASSWORD_MIN} characters`
    }
    return null
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFieldError('')
    const validationError = validate()
    if (validationError) {
      setFieldError(validationError)
      return
    }

    signUp.mutate(
      {
        email: email.trim(),
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        company_name: companyName.trim(),
      },
      {
        onSuccess: (data) => {
          if (data.session) {
            window.location.href = '/home'
            return
          }
          setPending('verify')
        },
        onError: (err) => {
          setFieldError(err instanceof Error ? err.message : 'Sign-up failed')
        },
      },
    )
  }

  const displayError = fieldError || (signUp.error instanceof Error ? signUp.error.message : '')
  const isLoading = signUp.isPending

  if (pending === 'verify') {
    return (
      <div className="relative min-h-screen bg-[#0A0612] text-white overflow-hidden flex items-center justify-center px-6 py-10">
        <div className="relative z-[2] w-full max-w-md text-center">
          <VerifyPanel email={email} />
        </div>
      </div>
    )
  }

  return (
    <AuthLayout
      maxWidth="max-w-[480px]"
      headline={<HeadlineWords className="font-serif" />}
      subhead="No credit card required. Set up in 5 minutes."
      footer={
        <p className="text-sm text-white/55">
          Already have an account?{' '}
          <a href="/login" className="text-[#C4B0FF] hover:underline transition-colors duration-150">
            Sign in
          </a>
        </p>
      }
    >
      <form onSubmit={handleSubmit} autoComplete="on" noValidate className="space-y-0">

        {/* Email */}
        <FloatField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="opacity-0 animate-fade-up motion-reduce:opacity-100 motion-reduce:animate-none delay-[400ms]"
        />

        {/* First + last name in 2-col grid */}
        <div className="grid grid-cols-2 gap-3 mt-3 opacity-0 animate-fade-up motion-reduce:opacity-100 motion-reduce:animate-none delay-[480ms]">
          <FloatField
            id="first_name"
            label="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            maxLength={NAME_MAX}
            required
            autoComplete="given-name"
          />
          <FloatField
            id="last_name"
            label="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            maxLength={NAME_MAX}
            required
            autoComplete="family-name"
          />
        </div>

        {/* Company */}
        <div className="mt-3 opacity-0 animate-fade-up motion-reduce:opacity-100 motion-reduce:animate-none delay-[560ms]">
          <FloatField
            id="company_name"
            label="Company name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            maxLength={COMPANY_MAX}
            required
            autoComplete="organization"
          />
        </div>

        {/* Password with strength meter */}
        <div className="mt-3 opacity-0 animate-fade-up motion-reduce:opacity-100 motion-reduce:animate-none delay-[640ms]">
          <PasswordField
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            showStrength
            required
            autoComplete="new-password"
            minLength={PASSWORD_MIN}
          />
        </div>

        {/* Error message */}
        {displayError && (
          <div
            role="alert"
            className="mt-4 px-3.5 py-2.5 rounded-[10px] text-[13px] text-[#FCA5A5]"
            style={{
              background: 'rgba(248,113,113,0.10)',
              border: '1px solid rgba(248,113,113,0.30)',
            }}
          >
            {displayError}
          </div>
        )}

        {/* Submit */}
        <div className="mt-6 opacity-0 animate-fade-up motion-reduce:opacity-100 motion-reduce:animate-none delay-[720ms]">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-14 rounded-xl text-[15px] font-medium text-white transition-[transform,box-shadow,opacity] duration-200 cursor-pointer disabled:opacity-65 disabled:cursor-wait hover:not-disabled:scale-[1.01] active:not-disabled:scale-[0.99] focus-visible:outline-2 focus-visible:outline-[#C4B0FF] focus-visible:outline-offset-[3px]"
            style={{
              background: 'linear-gradient(135deg, #7F77DD 0%, #6366F1 100%)',
              boxShadow: '0 8px 28px rgba(127,119,221,0.35)',
            }}
          >
            {isLoading ? 'Creating account…' : 'Start free trial →'}
          </button>
        </div>

        {/* Legal acceptance */}
        <LegalAcceptance />
      </form>

      {/* Trust row */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 justify-center mt-6 text-[13px] text-white/50 opacity-0 animate-fade-up motion-reduce:opacity-100 motion-reduce:animate-none delay-[800ms]">
        {TRUST_ITEMS.map((item) => (
          <TrustItem key={item.text} item={item} />
        ))}
      </div>
    </AuthLayout>
  )
}
