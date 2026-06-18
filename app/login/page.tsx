'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import AuthCardLayout from '@/components/features/auth/auth-card-layout'
import { AuthField } from '@/components/features/auth/auth-field'
import { AuthPasswordField } from '@/components/features/auth/auth-password-field'
import { AuthSubmitButton } from '@/components/features/auth/auth-submit-button'
import { useSignIn } from '@/hooks/auth/use-auth-mutations'
import { useAuthStore } from '@/stores/auth'
import { apiUrl } from '@/lib/api-client'
import { EMAIL_PLACEHOLDER } from '@/lib/auth-constants'
import { getSafeRedirect } from '@/lib/auth-utils'
import { getConsent } from '@/lib/cookies/consent'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = getSafeRedirect(searchParams.get('redirect'))
  const session = useAuthStore((s) => s.session)
  const isLoading = useAuthStore((s) => s.isLoading)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const signIn = useSignIn()

  useEffect(() => {
    if (!isLoading && session) router.replace(redirectTo)
  }, [isLoading, session, router, redirectTo])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    signIn.mutate(
      { email, password },
      {
        onSuccess: (data) => {
          // Fire-and-forget consent sync to Supabase
          const consent = getConsent()
          if (consent && data.session?.access_token) {
            fetch(apiUrl('auth/consent-sync'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${data.session.access_token}`,
              },
              body: JSON.stringify({ level: consent.level }),
            }).catch(() => {
              // Non-blocking — consent sync failure should not affect login
            })
          }
          router.push(redirectTo)
        },
      },
    )
  }

  return (
    <AuthCardLayout
      title="Welcome back"
      subtitle="Sign in to your Lynq & Flow workspace."
      footer={
        <p className="text-center text-sm text-foreground-3">
          Don&apos;t have an account?{' '}
          <Link href="/onboarding" className="font-semibold text-primary hover:opacity-80">
            Sign up
          </Link>
        </p>
      }
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
        />

        <AuthPasswordField
          id="password"
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          labelAction={
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-primary hover:opacity-80"
            >
              Forgot password?
            </Link>
          }
        />

        {signIn.error && (
          <p
            role="alert"
            className="rounded-[10px] border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive"
          >
            Incorrect email or password
          </p>
        )}

        <AuthSubmitButton pending={signIn.isPending} pendingLabel="Signing in…">
          Sign in
        </AuthSubmitButton>
      </form>
    </AuthCardLayout>
  )
}
