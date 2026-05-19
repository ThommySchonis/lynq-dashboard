'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import AuthLayout from '@/components/features/auth/auth-layout'
import { FloatField } from '@/components/features/auth/float-field'
import { PasswordField } from '@/components/features/auth/password-field'
import { useSignIn } from '@/hooks/auth/use-auth-mutations'
import { useAuthStore } from '@/stores/auth'
import { WORD_REVEAL_DELAY_MS } from '@/lib/auth-constants'

function getSafeRedirect(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return '/inbox'
  }
  try {
    const url = new URL(raw, window.location.origin)
    return url.origin === window.location.origin ? url.pathname + url.search + url.hash : '/inbox'
  } catch {
    return '/inbox'
  }
}

const HEADLINE_WORDS = ['Welcome', 'back']

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
        onSuccess: () => {
          router.push(redirectTo)
        },
      },
    )
  }

  const headline = (
    <>
      {HEADLINE_WORDS.map((word, i) => (
        <span
          key={word}
          className="inline-block opacity-0 animate-word-reveal will-change-[opacity,transform,filter] motion-reduce:opacity-100 motion-reduce:animate-none"
          style={{ animationDelay: `${i * WORD_REVEAL_DELAY_MS}ms` }}
        >
          {word}
          {i < HEADLINE_WORDS.length - 1 ? '\u00a0' : ''}
        </span>
      ))}
    </>
  )

  const footer = (
    <p className="m-0">
      New here?{' '}
      <Link
        href="/signup"
        className="text-[#C4B0FF] hover:underline transition-colors duration-150"
      >
        Start your free trial
      </Link>
    </p>
  )

  return (
    <AuthLayout
      headline={headline}
      subhead="Sign in to your Lynq &amp; Flow workspace."
      footer={footer}
    >
      <form onSubmit={handleSubmit} autoComplete="on" noValidate>
        <div className="opacity-0 animate-fade-up motion-reduce:opacity-100 motion-reduce:animate-none delay-[400ms]">
          <FloatField
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="opacity-0 animate-fade-up motion-reduce:opacity-100 motion-reduce:animate-none delay-[480ms] mt-3">
          <PasswordField
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <div className="mt-2 text-right">
            <Link
              href="/forgot-password"
              className="text-[13px] text-[#C4B0FF] hover:underline transition-colors duration-150"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {signIn.error && (
          <div
            role="alert"
            className="mt-4 px-3.5 py-2.5 rounded-[10px] text-[13px] text-[#FCA5A5] bg-red-400/10 border border-red-400/30"
          >
            Incorrect email or password
          </div>
        )}

        <div className="opacity-0 animate-fade-up motion-reduce:opacity-100 motion-reduce:animate-none delay-[560ms] mt-6">
          <button
            type="submit"
            disabled={signIn.isPending}
            className="w-full h-14 rounded-xl text-[15px] font-medium text-white cursor-pointer transition-[transform,box-shadow,opacity] duration-200 bg-gradient-to-br from-[#7F77DD] to-[#6366F1] shadow-[0_8px_28px_rgba(127,119,221,0.35)] hover:not-disabled:scale-[1.01] hover:not-disabled:shadow-[0_12px_36px_rgba(127,119,221,0.50)] active:not-disabled:scale-[0.99] disabled:opacity-65 disabled:cursor-wait focus-visible:outline-[2px] focus-visible:outline-[#C4B0FF] focus-visible:outline-offset-[3px]"
          >
            {signIn.isPending ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Signing in…
              </span>
            ) : (
              'Sign in →'
            )}
          </button>
        </div>
      </form>
    </AuthLayout>
  )
}
