'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, X, Loader, Building2, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import InviteLayout from '@/components/features/auth/invite-layout'
import { useInviteDetails } from '@/hooks/auth/use-auth-data'
import { useAcceptInvite } from '@/hooks/auth/use-auth-mutations'
import { getRoleLabel, expiryText, ERROR_COPY } from '@/lib/invite-utils'

export default function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const router = useRouter()

  const { data: invite, isLoading: inviteLoading, error: inviteError } = useInviteDetails(token)

  // Use the auth store (populated by AuthHydrator in root layout) instead of
  // a manual getSession() call. `isLoading` stays true until the first session
  // check resolves, giving us the same "loading" sentinel as before.
  const session = useAuthStore((s) => s.session)
  const authLoading = useAuthStore((s) => s.isLoading)

  const [status, setStatus] = useState<'idle' | 'accepted' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [mismatchInfo, setMismatchInfo] = useState<{ invite_email: string; user_email: string } | null>(null)

  const acceptMutation = useAcceptInvite(token)

  async function handleAccept() {
    if (!session) return
    acceptMutation.mutate(undefined, {
      onSuccess: () => {
        setStatus('accepted')
        setTimeout(() => router.push('/inbox'), 1800)
      },
      onError: (err: unknown) => {
        const e = err as Error & { code?: string; invite_email?: string; user_email?: string }
        if (e.code === 'email_mismatch') {
          setMismatchInfo({
            invite_email: e.invite_email ?? invite?.invite_email ?? '',
            user_email:   e.user_email   ?? session?.user?.email ?? '',
          })
          setStatus('idle')
          return
        }
        setStatus('error')
        setErrorMsg(e.message || 'Failed to accept invite.')
      },
    })
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setMismatchInfo(null)
    setStatus('idle')
  }

  // ── STATE: loading ──
  if (inviteLoading || authLoading) {
    return <InviteLayout loading />
  }

  // ── STATE D: invalid / expired / already accepted (query error) ──
  if (inviteError && !invite) {
    const errorCode = (inviteError as Error).message in ERROR_COPY
      ? (inviteError as Error).message
      : 'lookup_failed'
    const copy = ERROR_COPY[errorCode]
    return (
      <InviteLayout>
        <div className="px-8 py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <X size={22} strokeWidth={1.75} className="text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">{copy.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-5">{copy.msg}</p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center h-11 px-4 rounded-lg border border-[#E5E0EB] bg-white text-sm font-medium text-foreground no-underline"
          >
            Go to login
          </Link>
        </div>
      </InviteLayout>
    )
  }

  // ── STATE: accepted (post-success) ──
  if (status === 'accepted') {
    return (
      <InviteLayout>
        <div className="px-8 py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
            <Check size={24} strokeWidth={2} className="text-emerald-500" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">You&rsquo;re in!</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You&rsquo;ve joined <strong className="text-foreground">{invite?.workspace_name}</strong> as{' '}
            {getRoleLabel(invite?.role)}. Redirecting…
          </p>
        </div>
      </InviteLayout>
    )
  }

  // ── STATE: generic error after accept attempt ──
  if (status === 'error') {
    return (
      <InviteLayout>
        <div className="px-8 py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={22} strokeWidth={1.75} className="text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Something went wrong</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-5">{errorMsg}</p>
          <button
            onClick={() => { setStatus('idle'); setErrorMsg('') }}
            className="inline-flex items-center justify-center h-11 px-4 rounded-lg border border-[#E5E0EB] bg-white text-sm font-medium text-foreground cursor-pointer"
          >
            Try again
          </button>
        </div>
      </InviteLayout>
    )
  }

  // ── STATE: ready → choose A / B / C ──
  const userEmail   = session?.user?.email?.toLowerCase()
  const inviteEmail = invite?.invite_email?.toLowerCase()
  const clientMatch = session && userEmail && inviteEmail && userEmail === inviteEmail
  const emailMismatch = !!mismatchInfo || (session && !clientMatch)
  const emailMatch    = !mismatchInfo && clientMatch
  const mismatchInvite = mismatchInfo?.invite_email || invite?.invite_email
  const mismatchUser   = mismatchInfo?.user_email   || session?.user?.email

  return (
    <InviteLayout>
      <div className="px-8 pt-9 pb-8">
        {/* Workspace icon + invite headline */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-[14px] bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Building2 size={26} strokeWidth={1.5} className="text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-1.5">
            You&rsquo;re invited to join
          </h2>
          <p className="text-lg font-semibold text-primary m-0">
            {invite?.workspace_name}
          </p>
        </div>

        {/* Invite details panel */}
        <div className="bg-secondary rounded-lg px-4 py-3 mb-6 text-sm text-muted-foreground">
          <div className="flex justify-between py-1.5">
            <span>Role</span>
            <span className="font-semibold text-foreground">{getRoleLabel(invite?.role)}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span>For</span>
            <span className="font-medium text-foreground">{invite?.invite_email}</span>
          </div>
          {invite?.inviter_name && (
            <div className="flex justify-between py-1.5">
              <span>From</span>
              <span className="font-medium text-foreground">{invite.inviter_name}</span>
            </div>
          )}
          <div className="flex justify-between py-1.5 pt-2.5 border-t border-[#EDE9F1] mt-1">
            <span>Validity</span>
            <span className="text-foreground-4">{expiryText(invite?.expires_at)}</span>
          </div>
        </div>

        {/* STATE A: no session */}
        {!session && (
          <div className="flex gap-2">
            <Link
              href={`/login?redirect=/invites/${token}`}
              className="flex-1 inline-flex items-center justify-center h-11 px-4 rounded-lg border border-[#E5E0EB] bg-white text-sm font-medium text-foreground no-underline"
            >
              Sign in
            </Link>
            <Link
              href={`/invites/${token}/signup`}
              className="flex-1 inline-flex items-center justify-center h-11 px-4 rounded-lg border-none bg-primary text-sm font-medium text-white no-underline"
            >
              Create account
            </Link>
          </div>
        )}

        {/* STATE B: signed in, email matches */}
        {emailMatch && (
          <div>
            <div className="text-xs text-foreground-4 text-center mb-4 px-3 py-2 bg-secondary rounded-md">
              Accepting as <strong className="text-foreground">{session?.user?.email}</strong>
            </div>
            <button
              onClick={() => { void handleAccept() }}
              disabled={acceptMutation.isPending}
              className="w-full inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-lg border-none text-sm font-medium text-white cursor-pointer disabled:cursor-default"
              style={{ background: acceptMutation.isPending ? '#D4C5F9' : '#A175FC' }}
            >
              {acceptMutation.isPending ? (
                <>
                  <Loader size={15} strokeWidth={2} className="animate-spin" />
                  Accepting…
                </>
              ) : (
                <>
                  <Check size={15} strokeWidth={2} />
                  Accept invitation
                </>
              )}
            </button>
          </div>
        )}

        {/* STATE C: signed in, email mismatch */}
        {emailMismatch && (
          <div>
            <div className="flex gap-2.5 items-start bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-3 mb-3.5">
              <AlertCircle size={16} strokeWidth={1.75} className="text-amber-800 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-foreground leading-relaxed">
                This invite is for <strong>{mismatchInvite}</strong>.<br />
                You&rsquo;re signed in as <strong>{mismatchUser}</strong>.
              </div>
            </div>
            <button
              onClick={() => { void handleSignOut() }}
              className="w-full inline-flex items-center justify-center h-11 px-4 rounded-lg border border-[#E5E0EB] bg-white text-sm font-medium text-foreground cursor-pointer"
            >
              Sign out and use {mismatchInvite}
            </button>
          </div>
        )}
      </div>
    </InviteLayout>
  )
}
