'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import AuthCardLayout from '@/components/features/auth/auth-card-layout'
import { AuthPasswordField } from '@/components/features/auth/auth-password-field'
import { AuthSubmitButton } from '@/components/features/auth/auth-submit-button'
import { BackToSignIn } from '@/components/features/auth/back-to-sign-in'
import { useResetPassword } from '@/hooks/auth/use-auth-mutations'
import { supabase } from '@/lib/supabase'
import { PASSWORD_HINT_8 } from '@/lib/auth-constants'

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

const footer = (
  <div className="mt-7">
    <div className="h-px bg-border" />
    <div className="mt-5">
      <BackToSignIn />
    </div>
  </div>
)

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

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (session) {
        setSessionValid(true)
      } else {
        // Give the auth state listener a brief window to fire
        // (hash-parsing can be async). Then decide definitively.
        setTimeout(() => {
          if (cancelled) return
          void supabase.auth.getSession().then(({ data: { session: s2 } }) => {
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
  const displayError = errors.password?.message ?? errors.confirm?.message ?? clientError

  // ── Loading: session check in flight ──────────────────────────
  if (sessionValid === null) {
    return (
      <AuthCardLayout title="Set a new password" subtitle="Verifying your reset link…" footer={footer}>
        <div className="flex items-center justify-center gap-2 py-3 text-sm text-foreground-3">
          <Loader size={16} className="animate-spin" />
          <span>Loading…</span>
        </div>
      </AuthCardLayout>
    )
  }

  // ── Invalid / expired link ─────────────────────────────────────
  if (!sessionValid) {
    return (
      <AuthCardLayout
        title="Link expired"
        subtitle="This reset link is invalid or has expired. Request a new one to try again."
        footer={footer}
      >
        <Link
          href="/forgot-password"
          className="flex h-11 w-full items-center justify-center rounded-[10px] bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Request a new link
        </Link>
      </AuthCardLayout>
    )
  }

  // ── Success: password updated, auto-redirect ───────────────────
  if (success) {
    return (
      <AuthCardLayout title="Password updated" subtitle="Redirecting you to sign in…">
        <div className="flex items-center justify-center gap-2 py-3 text-sm text-foreground-3">
          <Loader size={16} className="animate-spin" />
          <span>Redirecting…</span>
        </div>
      </AuthCardLayout>
    )
  }

  // ── Form state ─────────────────────────────────────────────────
  return (
    <AuthCardLayout
      title="Set a new password"
      subtitle="Create a new password for your account."
      footer={footer}
    >
      <form
        onSubmit={(e) => {
          void handleSubmit(onSubmit)(e)
        }}
        autoComplete="on"
        noValidate
        className="space-y-4"
      >
        <AuthPasswordField
          id="new-password"
          label="New password"
          placeholder="Enter new password"
          helper={PASSWORD_HINT_8}
          autoComplete="new-password"
          {...register('password')}
        />

        <AuthPasswordField
          id="confirm-password"
          label="Confirm password"
          placeholder="Re-enter new password"
          autoComplete="new-password"
          {...register('confirm')}
        />

        {displayError && (
          <p
            role="alert"
            className="rounded-[10px] border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive"
          >
            {displayError}
          </p>
        )}

        <AuthSubmitButton pending={isLoading} pendingLabel="Updating…">
          Reset password
        </AuthSubmitButton>
      </form>
    </AuthCardLayout>
  )
}
