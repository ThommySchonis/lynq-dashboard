'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'
import { Check, X, Loader, Building2, AlertCircle } from 'lucide-react'

const ROLE_LABELS = {
  owner:    'Owner',
  admin:    'Admin',
  agent:    'Agent',
  observer: 'Observer',
}

function expiryText(expiresAt) {
  if (!expiresAt) return null
  const ms   = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const days = Math.floor(ms / (24 * 60 * 60 * 1000))
  if (days === 0) return 'Expires today'
  if (days === 1) return 'Expires tomorrow'
  return `Expires in ${days} days`
}

const ERROR_COPY = {
  not_found:        { title: 'Invite not found',      msg: "We couldn't find this invitation. The link may be incorrect." },
  expired:          { title: 'Invite expired',         msg: 'This invitation has expired. Ask the workspace owner to send you a new one.' },
  already_accepted: { title: 'Already accepted',       msg: 'This invitation has already been accepted. Sign in to access your workspace.' },
  lookup_failed:    { title: 'Something went wrong',   msg: 'Please try again in a moment.' },
}

export default function InviteAcceptPage() {
  const params  = useParams()
  const router  = useRouter()
  const token   = params?.token

  const [invite,    setInvite]    = useState(null)
  const [session,   setSession]   = useState(undefined)  // undefined = loading
  const [status,    setStatus]    = useState('loading')  // loading | ready | accepting | accepted | error | invalid
  const [errorCode, setErrorCode] = useState(null)
  const [errorMsg,  setErrorMsg]  = useState('')
  const [mismatchInfo, setMismatchInfo] = useState(null)  // { invite_email, user_email } from server when accept rejected

  useEffect(() => {
    if (!token) { setStatus('invalid'); setErrorCode('not_found'); return }

    Promise.all([
      fetch(`/api/invites/${token}`).then(async r => ({ ok: r.ok, body: await r.json().catch(() => ({})) })),
      supabase.auth.getSession(),
    ]).then(([res, { data: sessData }]) => {
      setSession(sessData.session)
      if (!res.ok || res.body.error) {
        setStatus('invalid')
        setErrorCode(res.body.error || 'lookup_failed')
        return
      }
      setInvite(res.body)
      setStatus('ready')
    }).catch(() => {
      setStatus('invalid')
      setErrorCode('lookup_failed')
    })
  }, [token])

  async function acceptInvite() {
    if (!session) return
    setStatus('accepting')
    const res = await fetch(`/api/invites/${token}/accept`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const data = await res.json().catch(() => ({}))

    if (res.ok) {
      setStatus('accepted')
      setTimeout(() => router.push('/'), 1800)
      return
    }

    // Server detected email mismatch — switch to the State C UX with
    // the authoritative emails from the response.
    if (data.code === 'email_mismatch') {
      setMismatchInfo({
        invite_email: data.invite_email,
        user_email:   data.user_email,
      })
      setStatus('ready')
      return
    }

    setStatus('error')
    setErrorMsg(data.error || 'Failed to accept invite.')
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setSession(null)
    setMismatchInfo(null)
    setStatus('ready')
  }

  // ── layout wrapper ────────────────────────────────────────────────────────
  const wrap = (content) => (
    <div style={{
      minHeight: '100vh', background: '#F8F7FA',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      fontFamily: "'Switzer', -apple-system, BlinkMacSystemFont, sans-serif",
      WebkitFontSmoothing: 'antialiased',
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#1C0F36', padding: '8px 16px', borderRadius: 8,
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '0.02em' }}>
              Lynq &amp; Flow
            </span>
          </div>
        </div>
        {content}
      </div>
    </div>
  )

  // ── STATE: loading ──
  if (status === 'loading' || session === undefined) {
    return wrap(
      <div style={{ background: '#fff', border: '1px solid #E5E0EB', borderRadius: 12, padding: '48px 32px', textAlign: 'center' }}>
        <Loader size={28} strokeWidth={1.75} color="#9B91A8" style={{ animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <p style={{ margin: '12px 0 0', fontSize: 14, color: '#9B91A8' }}>Loading invite…</p>
      </div>
    )
  }

  // ── STATE D: invalid / expired / already accepted ──
  if (status === 'invalid') {
    const copy = ERROR_COPY[errorCode] || ERROR_COPY.lookup_failed
    return wrap(
      <div style={{ background: '#fff', border: '1px solid #E5E0EB', borderRadius: 12, padding: '48px 32px', textAlign: 'center' }}>
        <div style={iconBubble('rgba(239,68,68,0.08)')}>
          <X size={22} strokeWidth={1.75} color="#EF4444" />
        </div>
        <h2 style={titleStyle}>{copy.title}</h2>
        <p style={{ ...bodyStyle, marginBottom: 20 }}>{copy.msg}</p>
        <Link href="/login" style={btnSecondaryStyle}>Go to login</Link>
      </div>
    )
  }

  // ── STATE: accepted (post-success) ──
  if (status === 'accepted') {
    return wrap(
      <div style={{ background: '#fff', border: '1px solid #E5E0EB', borderRadius: 12, padding: '48px 32px', textAlign: 'center' }}>
        <div style={iconBubble('rgba(16,185,129,0.1)')}>
          <Check size={24} strokeWidth={2} color="#10B981" />
        </div>
        <h2 style={titleStyle}>You&rsquo;re in!</h2>
        <p style={bodyStyle}>
          You&rsquo;ve joined <strong style={{ color: '#1C0F36' }}>{invite?.workspace_name}</strong> as {ROLE_LABELS[invite?.role] || invite?.role}. Redirecting…
        </p>
      </div>
    )
  }

  // ── STATE: error after attempting accept ──
  if (status === 'error') {
    return wrap(
      <div style={{ background: '#fff', border: '1px solid #E5E0EB', borderRadius: 12, padding: '40px 32px', textAlign: 'center' }}>
        <div style={iconBubble('rgba(239,68,68,0.08)')}>
          <AlertCircle size={22} strokeWidth={1.75} color="#EF4444" />
        </div>
        <h2 style={titleStyle}>Something went wrong</h2>
        <p style={{ ...bodyStyle, marginBottom: 20 }}>{errorMsg}</p>
        <button onClick={() => { setStatus('ready'); setErrorMsg('') }} style={btnSecondaryStyle}>Try again</button>
      </div>
    )
  }

  // ── STATE: ready → choose A / B / C ──
  const userEmail   = session?.user?.email?.toLowerCase()
  const inviteEmail = invite?.invite_email?.toLowerCase()
  const clientMatch = session && userEmail && inviteEmail && userEmail === inviteEmail
  // Server-side mismatch (returned by accept RPC) takes precedence over client comparison
  const emailMismatch = !!mismatchInfo || (session && !clientMatch)
  const emailMatch    = !mismatchInfo && clientMatch
  const mismatchInvite = mismatchInfo?.invite_email || invite?.invite_email
  const mismatchUser   = mismatchInfo?.user_email   || session?.user?.email

  return wrap(
    <div style={{ background: '#fff', border: '1px solid #E5E0EB', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ height: 4, background: 'linear-gradient(90deg, #A175FC, #6366F1)' }} />

      <div style={{ padding: '36px 32px 32px' }}>
        {/* Workspace icon + invite headline */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, background: '#EDE5FE',
            margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Building2 size={26} strokeWidth={1.5} color="#A175FC" />
          </div>
          <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 600, color: '#1C0F36' }}>
            You&rsquo;re invited to join
          </h2>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#A175FC' }}>
            {invite?.workspace_name}
          </p>
        </div>

        {/* Invite details panel */}
        <div style={{
          background: '#F8F7FA', borderRadius: 8, padding: '12px 16px', marginBottom: 24,
          fontSize: 13, color: '#6B5E7B',
        }}>
          <div style={detailRowStyle}>
            <span>Role</span>
            <span style={{ fontWeight: 600, color: '#1C0F36' }}>{ROLE_LABELS[invite?.role] || invite?.role}</span>
          </div>
          <div style={detailRowStyle}>
            <span>For</span>
            <span style={{ fontWeight: 500, color: '#1C0F36' }}>{invite?.invite_email}</span>
          </div>
          {invite?.inviter_name && (
            <div style={detailRowStyle}>
              <span>From</span>
              <span style={{ fontWeight: 500, color: '#1C0F36' }}>{invite.inviter_name}</span>
            </div>
          )}
          <div style={{ ...detailRowStyle, paddingTop: 6, borderTop: '1px solid #EDE9F1', marginTop: 4 }}>
            <span>Validity</span>
            <span style={{ color: '#9B91A8' }}>{expiryText(invite?.expires_at)}</span>
          </div>
        </div>

        {/* STATE A: no session */}
        {!session && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Link
              href={`/login?redirect=/invites/${token}`}
              style={{ ...btnSecondaryStyle, flex: 1, textAlign: 'center' }}
            >
              Sign in
            </Link>
            <Link
              href={`/invites/${token}/signup`}
              style={{ ...btnPrimaryStyle, flex: 1, textAlign: 'center' }}
            >
              Create account
            </Link>
          </div>
        )}

        {/* STATE B: signed in, email matches */}
        {emailMatch && (
          <div>
            <div style={signedInBoxStyle}>
              Accepting as <strong style={{ color: '#1C0F36' }}>{session.user.email}</strong>
            </div>
            <button
              onClick={acceptInvite}
              disabled={status === 'accepting'}
              style={{
                ...btnPrimaryStyle,
                width: '100%',
                background: status === 'accepting' ? '#D4C5F9' : '#A175FC',
                cursor: status === 'accepting' ? 'default' : 'pointer',
              }}
            >
              {status === 'accepting' ? (
                <>
                  <Loader size={15} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} />
                  <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
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
            <div style={{
              background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8,
              padding: '12px 14px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <AlertCircle size={16} strokeWidth={1.75} color="#92400E" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 13, color: '#1C0F36', lineHeight: 1.5 }}>
                This invite is for <strong>{mismatchInvite}</strong>.<br />
                You&rsquo;re signed in as <strong>{mismatchUser}</strong>.
              </div>
            </div>
            <button onClick={handleSignOut} style={{ ...btnSecondaryStyle, width: '100%' }}>
              Sign out and use {mismatchInvite}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── shared inline styles ─────────────────────────────────────────────────────
const iconBubble = (bg) => ({
  width: 48, height: 48, borderRadius: '50%', background: bg,
  margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
})
const titleStyle = { margin: '0 0 8px', fontSize: 20, fontWeight: 600, color: '#1C0F36' }
const bodyStyle  = { margin: 0, fontSize: 14, color: '#6B5E7B', lineHeight: 1.6 }
const detailRowStyle = { display: 'flex', justifyContent: 'space-between', padding: '5px 0' }
const signedInBoxStyle = {
  fontSize: 13, color: '#9B91A8', textAlign: 'center', marginBottom: 16,
  padding: '8px 12px', background: '#F8F7FA', borderRadius: 6,
}
const btnPrimaryStyle = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  height: 44, padding: '0 16px', borderRadius: 8, border: 'none',
  background: '#A175FC', color: '#fff', fontSize: 14, fontWeight: 500,
  cursor: 'pointer', textDecoration: 'none',
  fontFamily: "'Switzer', -apple-system, sans-serif",
}
const btnSecondaryStyle = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  height: 44, padding: '0 16px', borderRadius: 8, border: '1px solid #E5E0EB',
  background: '#fff', color: '#1C0F36', fontSize: 14, fontWeight: 500,
  cursor: 'pointer', textDecoration: 'none',
  fontFamily: "'Switzer', -apple-system, sans-serif",
}
