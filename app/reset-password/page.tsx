'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import AuthLayout from '@/components/features/auth/auth-layout'
import { PasswordField } from '@/components/features/auth/password-field'
import { useResetPassword } from '@/hooks/auth/use-auth-mutations'
import { supabase } from '@/lib/supabase'

const resetSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  })

type ResetFormValues = z.infer<typeof resetSchema>

export default function ResetPasswordPage() {
  const router = useRouter()

  const [clientError, setClientError] = useState('')
  const [success, setSuccess] = useState(false)

  // null = checking session, true = recovery session present, false = invalid/expired
  const [sessionValid, setSessionValid] = useState<null | boolean>(null)

  const resetPassword = useResetPassword()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
  })

  useEffect(() => {
    let cancelled = false

    // Supabase parses the hash fragment from the recovery email link
    // automatically and establishes a session. Listen for auth state changes
    // to capture the PASSWORD_RECOVERY event, plus do an initial session check.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setSessionValid(true)
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (session) {
        setSessionValid(true)
      } else {
        // Give the auth state listener a brief window to fire
        // (hash-parsing can be async). Then decide definitively.
        setTimeout(() => {
          if (cancelled) return
          supabase.auth.getSession().then(({ data: { session: s2 } }) => {
            if (!cancelled) setSessionValid(!!s2)
          })
        }, 500)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  // Auto-redirect after successful password update
  useEffect(() => {
    if (!success) return
    const t = setTimeout(() => {
      router.push('/login')
    }, 1500)
    return () => clearTimeout(t)
  }, [success, router])

  function onSubmit(values: ResetFormValues) {
    setClientError('')
    resetPassword.mutate(
      { password: values.password },
      {
        onSuccess: () => setSuccess(true),
        onError: (err) => {
          const message = err instanceof Error ? err.message : 'Could not update password.'
          setClientError(message)
        },
      },
    )
  }

  const isLoading = resetPassword.isPending

  // Collect the first field-level error to display (password takes priority, then confirm)
  const fieldError = errors.password?.message ?? errors.confirm?.message ?? ''
  const displayError = fieldError || clientError

  // ── Loading: session check in flight ──────────────────────────
  if (sessionValid === null) {
    return (
      <AuthLayout
        headline="Set a new password"
        subhead="Verifying your reset link…"
        footer={
          <>
            Remember your password?{' '}
            <Link href="/login" className="text-primary hover:text-[#C4B0FF] transition-colors">
              Sign in
            </Link>
          </>
        }
      >
        <div className="flex items-center justify-center gap-2 py-3 text-sm text-white/60">
          <Loader size={16} className="animate-spin" />
          <span>Loading…</span>
        </div>
      </AuthLayout>
    )
  }

  // ── Invalid / expired link ─────────────────────────────────────
  if (!sessionValid) {
    return (
      <AuthLayout
        headline="Link expired"
        subhead="This reset link is invalid or has expired. Request a new one to try again."
        footer={
          <>
            Remember your password?{' '}
            <Link href="/login" className="text-primary hover:text-[#C4B0FF] transition-colors">
              Sign in
            </Link>
          </>
        }
      >
        <div className="text-center">
          <Link
            href="/forgot-password"
            className="flex items-center justify-center w-full h-14 rounded-xl text-[15px] font-medium text-white transition-all duration-200 hover:brightness-110 active:scale-[0.99]"
            style={{
              background: 'linear-gradient(135deg, #7F77DD 0%, #6366F1 100%)',
              boxShadow: '0 8px 28px rgba(127, 119, 221, 0.35)',
            }}
          >
            Request a new link
          </Link>
        </div>
      </AuthLayout>
    )
  }

  // ── Success: password updated, auto-redirect ───────────────────
  if (success) {
    return (
      <AuthLayout
        headline="Password updated"
        subhead="Redirecting you to sign in…"
        footer={null}
      >
        <div className="flex items-center justify-center gap-2 py-3 text-sm text-white/60">
          <Loader size={16} className="animate-spin" />
          <span>Redirecting…</span>
        </div>
        <div className="mt-3 text-center">
          <Link
            href="/login"
            className="text-sm text-primary hover:text-[#C4B0FF] transition-colors"
          >
            Continue to sign in →
          </Link>
        </div>
      </AuthLayout>
    )
  }

  // ── Form state ─────────────────────────────────────────────────
  return (
    <AuthLayout
      headline="Set a new password"
      subhead="Choose a strong password to secure your account."
      footer={
        <>
          Remember your password?{' '}
          <Link href="/login" className="text-primary hover:text-[#C4B0FF] transition-colors">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} autoComplete="on" noValidate>
        <PasswordField
          id="new-password"
          label="New password"
          autoComplete="new-password"
          {...register('password')}
        />

        <div className="mt-3">
          <PasswordField
            id="confirm-password"
            label="Confirm new password"
            autoComplete="new-password"
            {...register('confirm')}
          />
        </div>

        {displayError && (
          <div
            role="alert"
            className="mt-4 px-3.5 py-2.5 rounded-xl text-[13px] text-red-300 bg-red-500/10 border border-red-500/30"
          >
            {displayError}
          </div>
        )}

        <div className="mt-6">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-14 rounded-xl text-[15px] font-medium text-white transition-all duration-200 hover:brightness-110 active:scale-[0.99] disabled:opacity-65 disabled:cursor-wait"
            style={{
              background: 'linear-gradient(135deg, #7F77DD 0%, #6366F1 100%)',
              boxShadow: '0 8px 28px rgba(127, 119, 221, 0.35)',
            }}
          >
            {isLoading ? 'Updating…' : 'Update password →'}
          </button>
        </div>
      </form>
    </AuthLayout>
  )
}
