'use client'

import { useState } from 'react'
import { Mail } from 'lucide-react'
import AuthCardLayout from '@/components/features/auth/auth-card-layout'
import { AuthField } from '@/components/features/auth/auth-field'
import { AuthSubmitButton } from '@/components/features/auth/auth-submit-button'
import { BackToSignIn } from '@/components/features/auth/back-to-sign-in'
import { useResetPasswordRequest } from '@/hooks/auth/use-auth-mutations'
import { EMAIL_PLACEHOLDER } from '@/lib/auth-constants'

const footer = <BackToSignIn />

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  const mutation = useResetPasswordRequest()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    mutation.mutate({ email: trimmed }, { onSuccess: () => setSent(true) })
  }

  const errorMessage =
    mutation.error instanceof Error
      ? mutation.error.message
      : mutation.error
        ? 'Something went wrong. Please try again.'
        : null

  // ── Success state ──────────────────────────────────────────
  if (sent) {
    return (
      <AuthCardLayout
        title="Check your email"
        subtitle="We've sent you a reset link. Click it to choose a new password."
        footer={footer}
      >
        <div className="space-y-4">
          <p className="text-sm text-foreground-3">
            We sent a reset link to{' '}
            <strong className="font-medium text-foreground">{email.trim()}</strong>. Check your
            inbox (and spam folder, just in case).
          </p>
          <button
            type="button"
            onClick={() => {
              setSent(false)
              mutation.reset()
            }}
            className="text-sm font-semibold text-primary hover:opacity-80"
          >
            Didn&apos;t get it? Try again
          </button>
        </div>
      </AuthCardLayout>
    )
  }

  // ── Form state ─────────────────────────────────────────────
  return (
    <AuthCardLayout
      title="Forgot password?"
      subtitle="Enter your email and we'll send you a reset link."
      footer={footer}
    >
      <form onSubmit={handleSubmit} autoComplete="on" noValidate className="space-y-4">
        <AuthField
          id="email"
          label="Email"
          type="email"
          icon={<Mail size={18} />}
          placeholder={EMAIL_PLACEHOLDER}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          error={errorMessage ?? undefined}
        />

        <AuthSubmitButton pending={mutation.isPending} pendingLabel="Sending…">
          Send reset link
        </AuthSubmitButton>
      </form>
    </AuthCardLayout>
  )
}
