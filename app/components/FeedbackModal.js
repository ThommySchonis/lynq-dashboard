'use client'

import { useState, useEffect, useRef } from 'react'
import { Bug, Lightbulb, MessageSquare, X, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const TYPES = [
  { key: 'bug',      label: 'Bug',      Icon: Bug,
    placeholder: 'What went wrong? Steps to reproduce help us a lot.' },
  { key: 'feedback', label: 'Feedback', Icon: Lightbulb,
    placeholder: 'What would make Lynq & Flow better for you?' },
  { key: 'other',    label: 'Other',    Icon: MessageSquare,
    placeholder: "Tell us what's on your mind." },
]

const MAX_LEN = 5000
const MIN_LEN = 5

export default function FeedbackModal({ open, onClose, onSuccess, onError }) {
  const [type, setType] = useState('bug')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef(null)
  const dialogRef = useRef(null)

  // Reset state on each open.
  useEffect(() => {
    if (open) {
      setType('bug')
      setMessage('')
      setSubmitting(false)
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [open])

  // ESC to close, focus trap basics.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, submitting, onClose])

  // Auto-resize textarea between min and max heights.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(240, Math.max(120, el.scrollHeight)) + 'px'
  }, [message])

  if (!open) return null

  const trimmedLen = message.trim().length
  const canSubmit = trimmedLen >= MIN_LEN && trimmedLen <= MAX_LEN && !submitting
  const placeholder = TYPES.find(t => t.key === type)?.placeholder || ''

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        onError?.('You must be logged in to send feedback.')
        setSubmitting(false)
        return
      }
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          type,
          message,
          page_url: typeof window !== 'undefined'
            ? (window.location.pathname + window.location.search) : null,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        onError?.(err.error || 'Something went wrong. Please try again.')
        setSubmitting(false)
        return
      }
      onSuccess?.()
      onClose()
    } catch (e) {
      console.error('[feedback] submit error:', e)
      onError?.('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fb-modal-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(28, 15, 54, 0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        animation: 'fbFade .15s ease-out',
      }}
    >
      <style>{`
        @keyframes fbFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes fbPop  { from { opacity: 0; transform: translateY(8px) scale(.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
        .fb-textarea:focus { border-color:#A175FC !important; box-shadow:0 0 0 3px rgba(161,117,252,0.25); }
        .fb-spin { animation: fbSpin .8s linear infinite; }
        @keyframes fbSpin { to { transform: rotate(360deg) } }
      `}</style>

      <div
        ref={dialogRef}
        style={{
          width: 480, maxWidth: '100%',
          background: '#FFFFFF',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(28,15,54,0.12)',
          padding: 24,
          fontFamily: "'Switzer',-apple-system,BlinkMacSystemFont,sans-serif",
          color: '#1C0F36',
          animation: 'fbPop .18s cubic-bezier(.16,1,.3,1)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          gap: 12, paddingBottom: 16, marginBottom: 20,
          borderBottom: '1px solid #F0EDF4',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 id="fb-modal-title" style={{
              fontSize: 18, fontWeight: 500, margin: 0, color: '#1C0F36', letterSpacing: '-0.01em',
            }}>
              Send feedback
            </h3>
            <p style={{
              fontSize: 13, color: '#6B5E7B', margin: '4px 0 0 0', lineHeight: 1.5,
            }}>
              Found a bug or have a suggestion? Let us know — we read every message.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            style={{
              background: 'none', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
              padding: 4, color: '#9B91A8', display: 'flex', flexShrink: 0,
            }}
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Type selector */}
        <label style={{
          display: 'block', fontSize: 13, fontWeight: 500, color: '#1C0F36', marginBottom: 8,
        }}>
          Type
        </label>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
        }}>
          {TYPES.map(({ key, label, Icon }) => {
            const active = type === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setType(key)}
                disabled={submitting}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  height: 36, padding: '10px 12px',
                  borderRadius: 8,
                  background: active ? '#EDE5FE' : '#F8F7FA',
                  border: `1px solid ${active ? '#A175FC' : '#E5E0EB'}`,
                  color: active ? '#A175FC' : '#6B5E7B',
                  fontSize: 13,
                  fontWeight: active ? 500 : 400,
                  fontFamily: 'inherit',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  transition: 'background .12s, border-color .12s, color .12s',
                }}
              >
                <Icon size={14} strokeWidth={1.75} />
                {label}
              </button>
            )
          })}
        </div>

        {/* Message */}
        <label style={{
          display: 'block', fontSize: 13, fontWeight: 500, color: '#1C0F36',
          marginTop: 16, marginBottom: 8,
        }}>
          Message
        </label>
        <textarea
          ref={textareaRef}
          className="fb-textarea"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_LEN))}
          placeholder={placeholder}
          disabled={submitting}
          rows={5}
          style={{
            width: '100%',
            minHeight: 120, maxHeight: 240,
            padding: 12,
            borderRadius: 8,
            border: '1px solid #E5E0EB',
            fontSize: 14, fontWeight: 400,
            fontFamily: 'inherit',
            color: '#1C0F36',
            background: '#FFFFFF',
            resize: 'none',
            outline: 'none',
            transition: 'border-color .12s, box-shadow .12s',
            lineHeight: 1.5,
            boxSizing: 'border-box',
          }}
        />
        <div style={{
          fontSize: 12, color: '#9B91A8',
          textAlign: 'right',
          marginTop: 4,
        }}>
          {trimmedLen} / {MAX_LEN}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
          paddingTop: 16, marginTop: 20,
          borderTop: '1px solid #F0EDF4',
        }}>
          <span style={{
            fontSize: 12, color: '#9B91A8', flex: 1, lineHeight: 1.4,
          }}>
            We&apos;ll include the page you&apos;re on and your browser info.
          </span>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                height: 36, padding: '0 14px',
                background: '#FFFFFF',
                border: '1px solid #1C0F36',
                color: '#1C0F36',
                borderRadius: 8,
                fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              style={{
                height: 36, padding: '0 14px',
                background: '#A175FC',
                border: '1px solid #A175FC',
                color: '#FFFFFF',
                borderRadius: 8,
                fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                opacity: canSubmit ? 1 : 0.5,
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'opacity .12s',
              }}
            >
              {submitting ? (
                <svg className="fb-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 12a9 9 0 1 1-6.22-8.55" />
                </svg>
              ) : (
                <Send size={14} strokeWidth={1.75} />
              )}
              {submitting ? 'Sending…' : 'Send feedback'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
