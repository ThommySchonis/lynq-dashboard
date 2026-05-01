'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { Check, X, Loader, Building2 } from 'lucide-react'

function roleName(role) {
  return role === 'admin' ? 'Admin' : 'Member'
}

export default function InviteAcceptPage() {
  const params  = useParams()
  const router  = useRouter()
  const token   = params?.token

  const [invite,    setInvite]    = useState(null)
  const [session,   setSession]   = useState(undefined)  // undefined = loading
  const [status,    setStatus]    = useState('loading')  // loading | ready | accepting | accepted | error | invalid
  const [errorMsg,  setErrorMsg]  = useState('')

  // Load invite metadata + check session in parallel
  useEffect(() => {
    if (!token) { setStatus('invalid'); return }

    Promise.all([
      fetch(`/api/invites/${token}`).then(r => r.json()),
      supabase.auth.getSession(),
    ]).then(([inviteData, { data: sessData }]) => {
      if (inviteData.error) {
        setStatus('invalid')
        setErrorMsg(inviteData.error)
      } else {
        setInvite(inviteData.invite)
        setSession(sessData.session)
        setStatus('ready')
      }
    }).catch(() => {
      setStatus('invalid')
      setErrorMsg('Something went wrong. Please try again.')
    })
  }, [token])

  async function accept() {
    if (!session) {
      // Redirect to login, come back after
      router.push(`/login?redirect=/invites/${token}`)
      return
    }

    setStatus('accepting')
    const res = await fetch(`/api/invites/${token}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const data = await res.json()

    if (res.ok) {
      setStatus('accepted')
      setTimeout(() => router.push('/'), 2500)
    } else {
      setStatus('error')
      setErrorMsg(data.error || 'Failed to accept invite.')
    }
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
        {/* Logo */}
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

  // ── loading ───────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return wrap(
      <div style={{
        background: '#fff', border: '1px solid #E5E0EB', borderRadius: 12,
        padding: '48px 32px', textAlign: 'center',
      }}>
        <Loader size={28} strokeWidth={1.75} color="#9B91A8"
          style={{ animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <p style={{ margin: '12px 0 0', fontSize: 14, color: '#9B91A8' }}>Loading invite…</p>
      </div>
    )
  }

  // ── invalid / expired ─────────────────────────────────────────────────────
  if (status === 'invalid') {
    return wrap(
      <div style={{
        background: '#fff', border: '1px solid #E5E0EB', borderRadius: 12,
        padding: '48px 32px', textAlign: 'center',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'rgba(239,68,68,0.08)', margin: '0 auto 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <X size={22} strokeWidth={1.75} color="#EF4444" />
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 600, color: '#1C0F36' }}>
          Invite unavailable
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: '#6B5E7B', lineHeight: 1.6 }}>
          {errorMsg || 'This invite link is invalid, expired, or has already been used.'}
        </p>
      </div>
    )
  }

  // ── accepted ──────────────────────────────────────────────────────────────
  if (status === 'accepted') {
    return wrap(
      <div style={{
        background: '#fff', border: '1px solid #E5E0EB', borderRadius: 12,
        padding: '48px 32px', textAlign: 'center',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'rgba(16,185,129,0.1)', margin: '0 auto 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Check size={24} strokeWidth={2} color="#10B981" />
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 600, color: '#1C0F36' }}>
          You&rsquo;re in!
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: '#6B5E7B', lineHeight: 1.6 }}>
          You&rsquo;ve joined <strong style={{ color: '#1C0F36' }}>{invite?.workspace_name}</strong> as {roleName(invite?.role)}. Redirecting you now…
        </p>
      </div>
    )
  }

  // ── error after attempting accept ─────────────────────────────────────────
  if (status === 'error') {
    return wrap(
      <div style={{
        background: '#fff', border: '1px solid #E5E0EB', borderRadius: 12,
        padding: '40px 32px', textAlign: 'center',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'rgba(239,68,68,0.08)', margin: '0 auto 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <X size={22} strokeWidth={1.75} color="#EF4444" />
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 600, color: '#1C0F36' }}>
          Something went wrong
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6B5E7B', lineHeight: 1.6 }}>
          {errorMsg}
        </p>
        <button onClick={() => { setStatus('ready'); setErrorMsg('') }} style={{
          padding: '0 20px', height: 38, borderRadius: 8, border: '1px solid #E5E0EB',
          background: '#fff', fontSize: 13, fontWeight: 500, color: '#1C0F36',
          cursor: 'pointer', fontFamily: "'Switzer', -apple-system, sans-serif",
        }}>
          Try again
        </button>
      </div>
    )
  }

  // ── ready — main accept view ──────────────────────────────────────────────
  return wrap(
    <div style={{
      background: '#fff', border: '1px solid #E5E0EB', borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* Top accent bar */}
      <div style={{ height: 4, background: 'linear-gradient(90deg, #A175FC, #6366F1)' }} />

      <div style={{ padding: '36px 32px 32px' }}>
        {/* Workspace icon + name */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: '#EDE5FE', margin: '0 auto 12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
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

        {/* Details */}
        <div style={{
          background: '#F8F7FA', borderRadius: 8, padding: '14px 16px',
          marginBottom: 24, fontSize: 13, color: '#6B5E7B', lineHeight: 1.8,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Role</span>
            <span style={{
              fontWeight: 600, color: '#1C0F36',
              background: invite?.role === 'admin' ? '#EDE5FE' : '#F0EDF4',
              color: invite?.role === 'admin' ? '#A175FC' : '#6B5E7B',
              padding: '1px 8px', borderRadius: 4, fontSize: 12, letterSpacing: '0.04em',
            }}>
              {roleName(invite?.role)}
            </span>
          </div>
        </div>

        {/* Session state */}
        {session ? (
          <div>
            <div style={{
              fontSize: 13, color: '#9B91A8', textAlign: 'center',
              marginBottom: 16, padding: '8px 12px',
              background: '#F8F7FA', borderRadius: 6,
            }}>
              Accepting as <strong style={{ color: '#1C0F36' }}>{session.user.email}</strong>
            </div>
            <button
              onClick={accept}
              disabled={status === 'accepting'}
              style={{
                width: '100%', height: 44, borderRadius: 8, border: 'none',
                background: status === 'accepting' ? '#D4C5F9' : '#A175FC',
                color: '#fff', fontSize: 14, fontWeight: 500,
                cursor: status === 'accepting' ? 'default' : 'pointer',
                fontFamily: "'Switzer', -apple-system, sans-serif",
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
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
        ) : (
          <div>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#9B91A8', textAlign: 'center' }}>
              Sign in to accept this invitation
            </p>
            <button
              onClick={accept}
              style={{
                width: '100%', height: 44, borderRadius: 8, border: 'none',
                background: '#A175FC', color: '#fff',
                fontSize: 14, fontWeight: 500, cursor: 'pointer',
                fontFamily: "'Switzer', -apple-system, sans-serif",
              }}
            >
              Sign in to accept
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
