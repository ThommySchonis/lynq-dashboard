'use client'

import { useState } from 'react'
import Link from 'next/link'
import AuthLayout from '@/components/features/auth/auth-layout'
import { FloatField } from '@/components/features/auth/float-field'
import { useResetPasswordRequest } from '@/hooks/auth/use-auth-mutations'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  const mutation = useResetPasswordRequest()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    mutation.mutate(
      { email: trimmed },
      {
        onSuccess: () => setSent(true),
      },
    )
  }

  const errorMessage =
    mutation.error instanceof Error
      ? mutation.error.message
      : mutation.error
        ? 'Something went wrong. Please try again.'
        : null

  const footer = (
    <>
      Remember your password?{' '}
      <Link href="/login" className="text-[#C4B0FF] hover:text-white transition-colors">
        Back to sign in
      </Link>
    </>
  )

  // ── Success state ──────────────────────────────────────────
  if (sent) {
    return (
      <AuthLayout
        headline="Check your email"
        subhead="We've sent you a reset link. Click it to choose a new password."
        footer={footer}
        showOrbs={false}
      >
        <div className="text-center py-2 space-y-4">
          <p className="text-[15px] text-white/70">
            ✉️ We sent a reset link to{' '}
            <strong className="text-white font-medium">{email.trim()}</strong>.{' '}
            Check your inbox (and spam folder, just in case).
          </p>
          <button
            type="button"
            onClick={() => {
              setSent(false)
              mutation.reset()
            }}
            className="text-[14px] font-medium text-[#C4B0FF] underline underline-offset-2 hover:text-white transition-colors bg-transparent border-none cursor-pointer p-0"
          >
            Didn&apos;t get it? Try again
          </button>
        </div>
      </AuthLayout>
    )
  }

  // ── Form state ─────────────────────────────────────────────
  return (
    <AuthLayout
      headline="Reset your password"
      subhead="Enter your email and we'll send you a reset link."
      footer={footer}
      showOrbs={false}
    >
      <form onSubmit={handleSubmit} autoComplete="on" noValidate>
        <FloatField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 px-3.5 py-2.5 rounded-[10px] bg-red-500/10 border border-red-500/30 text-[13px] text-red-300"
          >
            {errorMessage}
          </div>
        )}

        <div className="mt-6">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full h-14 rounded-xl text-[15px] font-medium text-white transition-[transform,box-shadow,opacity] duration-200 ease-[ease] disabled:opacity-65 disabled:cursor-wait hover:enabled:scale-[1.01]"
            style={{
              background: 'linear-gradient(135deg, #7F77DD 0%, #6366F1 100%)',
              boxShadow: '0 8px 28px rgba(127,119,221,0.35)',
            }}
          >
            {mutation.isPending ? 'Sending…' : 'Send reset link →'}
          </button>
        </div>
      </form>
    </AuthLayout>
  )
}
