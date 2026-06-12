'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader, AlertCircle, Building2, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import InviteLayout from '@/components/features/auth/invite-layout'
import { useInviteDetails } from '@/hooks/auth/use-auth-data'
import { useInviteSignup } from '@/hooks/auth/use-auth-mutations'
import { PasswordField } from '@/components/features/auth/password-field'
import { FloatField } from '@/components/features/auth/float-field'
import { getRoleLabel } from '@/lib/invite-utils'

const inviteSignupSchema = z.object({
  fullName: z.string().min(1, 'Please enter your name.'),
  password: z.string().min(8, 'At least 8 characters.'),
  confirm: z.string(),
}).refine(data => data.password === data.confirm, {
  message: 'Passwords do not match.',
  path: ['confirm'],
})

type InviteSignupFields = z.infer<typeof inviteSignupSchema>

interface ErrorBanner {
  msg: string
  code?: string
}

export default function InviteSignupPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const router = useRouter()

  const { data: invite, isLoading: inviteLoading, error: inviteError } = useInviteDetails(token)

  const [done, setDone] = useState(false)
  const [errorBanner, setErrorBanner] = useState<ErrorBanner | null>(null)

  const signupMutation = useInviteSignup(token)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<InviteSignupFields>({
    resolver: zodResolver(inviteSignupSchema),
  })

  // Redirect to the landing page whenever the invite query errors out
  useEffect(() => {
    if (inviteError) {
      router.replace(`/invites/${token}`)
    }
  }, [inviteError, router, token])

  function onSubmit(fields: InviteSignupFields) {
    setErrorBanner(null)

    signupMutation.mutate(
      { full_name: fields.fullName.trim(), password: fields.password },
      {
        onSuccess: () => { void (async () => {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: invite!.invite_email,
            password: fields.password,
          })

          if (signInError) {
            setErrorBanner({
              msg: 'Account created but auto sign-in failed. Please go to login and sign in with your new password.',
            })
            return
          }

          setDone(true)
          setTimeout(() => router.push('/inbox'), 800)
        })() },
        onError: (err: unknown) => {
          const e = err as Error & { code?: string }
          if (e.code === 'email_exists') {
            setErrorBanner({ code: 'email_exists', msg: e.message })
          } else if (
            e.code === 'expired' ||
            e.code === 'not_found' ||
            e.code === 'already_accepted'
          ) {
            router.replace(`/invites/${token}`)
          } else if (e.code === 'weak_password') {
            setError('password', { message: e.message || 'Password too weak.' })
          } else if (e.code === 'name_required') {
            setError('fullName', { message: e.message || 'Name is required.' })
          } else {
            setErrorBanner({ msg: e.message || 'Could not create your account. Please try again.' })
          }
        },
      },
    )
  }

  // ── STATE: loading ──
  if (inviteLoading || !invite) {
    return <InviteLayout loading />
  }

  // ── STATE: done ──
  if (done) {
    return (
      <InviteLayout>
        <div className="px-8 py-12 text-center">
          <div className="w-[52px] h-[52px] rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
            <Check size={24} strokeWidth={2} className="text-emerald-500" />
          </div>
          <h2 className="text-[20px] font-semibold text-foreground mb-2">
            Welcome to {invite.workspace_name}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">Signing you in…</p>
        </div>
      </InviteLayout>
    )
  }

  return (
    <InviteLayout>
      <div className="px-8 pt-9 pb-7">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-[52px] h-[52px] rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Building2 size={24} strokeWidth={1.5} className="text-primary" />
          </div>
          <h2 className="text-[19px] font-semibold text-foreground mb-1">
            Join {invite.workspace_name}
          </h2>
          <p className="text-sm text-muted-foreground m-0">
            Create your account to accept the invite as{' '}
            {getRoleLabel(invite.role)}
          </p>
        </div>

        {/* Error banner */}
        {errorBanner && (
          <div className="flex gap-2.5 items-start bg-red-50 border border-red-200 rounded-lg px-3.5 py-3 mb-4 text-sm text-red-700">
            <AlertCircle size={16} strokeWidth={1.75} className="flex-shrink-0 mt-0.5" />
            <div>
              {errorBanner.msg}
              {errorBanner.code === 'email_exists' && (
                <>
                  {' '}
                  <Link href="/login" className="text-primary font-medium">
                    Go to login →
                  </Link>
                </>
              )}
            </div>
          </div>
        )}

        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }} className="space-y-3.5">
          {/* Email — locked */}
          <FloatField
            id="signup-email"
            label="Email"
            type="email"
            value={invite.invite_email}
            readOnly
            disabled
            tone="light"
            className="cursor-not-allowed opacity-100 text-muted-foreground"
          />
          <p className="text-xs text-foreground-4 -mt-2">Locked to your invite address</p>

          {/* Full name */}
          <FloatField
            id="signup-name"
            label="Your name"
            type="text"
            autoComplete="name"
            error={errors.fullName?.message}
            required
            maxLength={100}
            autoFocus
            tone="light"
            {...register('fullName')}
          />

          {/* Password */}
          <PasswordField
            id="signup-password"
            label="Password"
            autoComplete="new-password"
            error={errors.password?.message}
            required
            minLength={8}
            tone="light"
            {...register('password')}
          />

          {/* Confirm password */}
          <PasswordField
            id="signup-confirm"
            label="Confirm password"
            autoComplete="new-password"
            error={errors.confirm?.message}
            required
            tone="light"
            {...register('confirm')}
          />

          <button
            type="submit"
            disabled={signupMutation.isPending}
            className="w-full inline-flex items-center justify-center gap-1.5 h-11 px-4 mt-1 rounded-lg border-none bg-primary text-sm font-medium text-white cursor-pointer disabled:opacity-70 disabled:cursor-default"
          >
            {signupMutation.isPending ? (
              <>
                <Loader size={15} strokeWidth={2} className="animate-spin" />
                Creating account…
              </>
            ) : (
              <>Create account &amp; join {invite.workspace_name}</>
            )}
          </button>

          <p className="text-xs text-foreground-4 text-center mt-4">
            Already have an account?{' '}
            <Link
              href={`/login?redirect=/invites/${token}`}
              className="text-primary font-medium"
            >
              Sign in instead
            </Link>
          </p>
        </form>
      </div>
    </InviteLayout>
  )
}
