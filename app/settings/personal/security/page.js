'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../../../lib/supabase'
import { ChevronRight, Shield, ShieldCheck, Eye, EyeOff, Copy, Download, Monitor, ChevronDown } from 'lucide-react'

/* ─────────────────────────────────────────────
   CSS
───────────────────────────────────────────── */
const CSS = `
  .sc-root * { box-sizing: border-box; }
  .sc-root {
    font-family: 'Switzer', -apple-system, BlinkMacSystemFont, sans-serif;
    -webkit-font-smoothing: antialiased;
    background: #F8F7FA;
    min-height: 100vh;
  }

  .sc-input {
    width: 100%;
    border: 1px solid #E5E0EB;
    border-radius: 8px;
    padding: 9px 12px;
    font-size: 14px;
    color: #1C0F36;
    background: #FFFFFF;
    outline: none;
    font-family: 'Switzer', -apple-system, BlinkMacSystemFont, sans-serif;
    transition: border-color 0.15s, box-shadow 0.15s;
    line-height: 1.5;
  }
  .sc-input:focus { border-color: #A175FC; box-shadow: 0 0 0 3px rgba(161,117,252,0.12); }
  .sc-input.error { border-color: #EF4444; box-shadow: 0 0 0 3px rgba(239,68,68,0.1); }
  .sc-input::placeholder { color: #9B91A8; }

  .sc-input-wrap { position: relative; }
  .sc-input-wrap .sc-input { padding-right: 40px; }
  .sc-eye {
    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer; color: #9B91A8;
    display: flex; align-items: center; padding: 0; line-height: 1;
  }
  .sc-eye:hover { color: #6B5E7B; }

  .sc-btn-primary {
    background: #A175FC; color: #FFFFFF; border: none; border-radius: 8px;
    padding: 9px 20px; font-size: 14px; font-weight: 600;
    font-family: 'Switzer', -apple-system, BlinkMacSystemFont, sans-serif;
    cursor: pointer; min-height: 36px; display: inline-flex; align-items: center;
    gap: 8px; transition: background 0.15s, opacity 0.15s; outline: none;
  }
  .sc-btn-primary:hover:not(:disabled) { background: #B990FF; }
  .sc-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
  .sc-btn-primary:focus-visible { outline: 2px solid #A175FC; outline-offset: 2px; }

  .sc-btn-secondary {
    background: #FFFFFF; color: #6B5E7B; border: 1px solid #E5E0EB;
    border-radius: 8px; padding: 9px 16px; font-size: 14px; font-weight: 500;
    font-family: 'Switzer', -apple-system, BlinkMacSystemFont, sans-serif;
    cursor: pointer; min-height: 36px; display: inline-flex; align-items: center;
    gap: 8px; transition: background 0.15s, border-color 0.15s; outline: none;
  }
  .sc-btn-secondary:hover { background: #F8F7FA; border-color: #C8C0D4; }
  .sc-btn-secondary:disabled { opacity: 0.45; cursor: not-allowed; }
  .sc-btn-secondary:focus-visible { outline: 2px solid #A175FC; outline-offset: 2px; }

  .sc-btn-ghost {
    background: transparent; color: #6B5E7B; border: none;
    border-radius: 8px; padding: 9px 14px; font-size: 14px; font-weight: 500;
    font-family: 'Switzer', -apple-system, BlinkMacSystemFont, sans-serif;
    cursor: pointer; min-height: 36px; display: inline-flex; align-items: center;
    gap: 8px; transition: background 0.15s; outline: none;
  }
  .sc-btn-ghost:hover { background: #F0EDF4; }
  .sc-btn-ghost:focus-visible { outline: 2px solid #A175FC; outline-offset: 2px; }

  .sc-btn-destructive {
    background: #EF4444; color: #FFFFFF; border: none; border-radius: 8px;
    padding: 9px 16px; font-size: 14px; font-weight: 600;
    font-family: 'Switzer', -apple-system, BlinkMacSystemFont, sans-serif;
    cursor: pointer; min-height: 36px; display: inline-flex; align-items: center;
    gap: 8px; transition: background 0.15s; outline: none;
  }
  .sc-btn-destructive:hover:not(:disabled) { background: #DC2626; }
  .sc-btn-destructive:disabled { opacity: 0.45; cursor: not-allowed; }

  .sc-btn-ghost-red {
    background: transparent; color: #EF4444; border: none; border-radius: 8px;
    padding: 9px 14px; font-size: 14px; font-weight: 500;
    font-family: 'Switzer', -apple-system, BlinkMacSystemFont, sans-serif;
    cursor: pointer; min-height: 36px; display: inline-flex; align-items: center;
    gap: 8px; transition: background 0.15s; outline: none;
  }
  .sc-btn-ghost-red:hover { background: rgba(239,68,68,0.07); }

  .sc-strength-bar {
    height: 4px; border-radius: 2px; margin-top: 6px;
    transition: width 0.3s, background 0.3s;
  }

  .sc-code-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 14px; font-weight: 600; color: #1C0F36;
  }
  .sc-code-item {
    background: #F8F7FA; border: 1px solid #E5E0EB; border-radius: 6px;
    padding: 6px 10px; letter-spacing: 0.05em;
  }

  .sc-warning {
    background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.3);
    border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #92400E;
    line-height: 1.5;
  }

  .sc-checkbox-row {
    display: flex; align-items: flex-start; gap: 10px; cursor: pointer;
    user-select: none;
  }
  .sc-checkbox {
    width: 16px; height: 16px; border-radius: 4px; border: 2px solid #E5E0EB;
    flex-shrink: 0; margin-top: 1px; display: flex; align-items: center;
    justify-content: center; transition: border-color 0.15s, background 0.15s;
    cursor: pointer;
  }
  .sc-checkbox.checked { background: #A175FC; border-color: #A175FC; }

  @keyframes sc-toast-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .sc-toast {
    position: fixed; bottom: 32px; right: 32px; background: #FFFFFF;
    border: 1px solid rgba(161,117,252,0.3); border-radius: 10px;
    padding: 12px 18px; color: #1C0F36; font-size: 14px; font-weight: 500;
    font-family: 'Switzer', -apple-system, BlinkMacSystemFont, sans-serif;
    z-index: 9999; animation: sc-toast-in 0.25s ease-out both;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    display: flex; align-items: center; gap: 10px; max-width: 360px;
  }
  .sc-toast.error { border-color: rgba(239,68,68,0.3); }

  @keyframes sc-overlay-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes sc-dialog-in {
    from { opacity: 0; transform: translateY(14px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .sc-mono { font-family: 'Courier New', Courier, monospace; font-size: 13px; letter-spacing: 0.06em; }

  .sc-step-dots { display: flex; align-items: center; gap: 6px; }
  .sc-step-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #E5E0EB; transition: background 0.2s;
  }
  .sc-step-dot.active { background: #A175FC; }
  .sc-step-dot.done   { background: #4ade80; }

  .sc-manage-menu {
    position: absolute; top: calc(100% + 6px); right: 0;
    background: #FFFFFF; border: 1px solid #E5E0EB; border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.1);
    z-index: 50; min-width: 200px; overflow: hidden;
    animation: sc-dialog-in 0.15s ease-out;
  }
  .sc-menu-item {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px; font-size: 14px; color: #1C0F36;
    cursor: pointer; transition: background 0.1s; border: none;
    background: transparent; width: 100%; text-align: left;
    font-family: 'Switzer', -apple-system, BlinkMacSystemFont, sans-serif;
  }
  .sc-menu-item:hover { background: #F8F7FA; }
  .sc-menu-item.danger { color: #EF4444; }
  .sc-menu-item.danger:hover { background: rgba(239,68,68,0.05); }

  .sc-skeleton {
    background: linear-gradient(90deg, #F0EDF4 25%, #E8E3EE 50%, #F0EDF4 75%);
    background-size: 200% 100%;
    animation: sc-shimmer 1.4s infinite;
    border-radius: 6px;
  }
  @keyframes sc-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
function getPwStrength(pw) {
  if (pw.length < 8) return 'weak'
  const checks = [/[A-Z]/.test(pw), /[a-z]/.test(pw), /[0-9]/.test(pw), /[^A-Za-z0-9]/.test(pw)]
  const score = checks.filter(Boolean).length
  if (pw.length >= 12 && score >= 3) return 'strong'
  if (score >= 2) return 'medium'
  return 'weak'
}

function parseDevice(ua = '') {
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  return `${browser} on ${os}`
}

function copyText(text) {
  navigator.clipboard?.writeText(text).catch(() => {})
}

function downloadCodes(codes) {
  const blob = new Blob([codes.join('\n')], { type: 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'lynq-recovery-codes.txt'
  a.click()
  URL.revokeObjectURL(a.href)
}

/* ─────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────── */
function SettingsHeader({ breadcrumb, title, subtitle }) {
  return (
    <div style={{ borderBottom: '1px solid #F0EDF4', paddingBottom: 24, marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9B91A8', marginBottom: 6, flexWrap: 'wrap' }}>
        {breadcrumb.map((c, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <ChevronRight size={12} strokeWidth={1.75} />}
            <span>{c}</span>
          </span>
        ))}
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 600, color: '#1C0F36', margin: '0 0 4px 0', lineHeight: 1.2 }}>{title}</h1>
      {subtitle && <p style={{ fontSize: 14, color: '#6B5E7B', margin: 0, lineHeight: 1.6 }}>{subtitle}</p>}
    </div>
  )
}

function SectionTitle({ title, description }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 18, fontWeight: 500, color: '#1C0F36', margin: description ? '0 0 4px 0' : 0, lineHeight: 1.3 }}>{title}</h3>
      {description && <p style={{ fontSize: 14, color: '#6B5E7B', margin: 0, lineHeight: 1.6 }}>{description}</p>}
    </div>
  )
}

function Card({ children, footer, style }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E5E0EB', borderRadius: 12, overflow: 'hidden', ...style }}>
      <div style={{ padding: 24 }}>{children}</div>
      {footer && (
        <div style={{ borderTop: '1px solid #F0EDF4', padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          {footer}
        </div>
      )}
    </div>
  )
}

function Field({ label, error, helpText, children }) {
  return (
    <div>
      {label && <div style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>{label}</div>}
      {children}
      {error && <div style={{ fontSize: 12, color: '#EF4444', marginTop: 4 }}>{error}</div>}
      {helpText && !error && <div style={{ fontSize: 12, color: '#9B91A8', marginTop: 4 }}>{helpText}</div>}
    </div>
  )
}

function PwInput({ value, onChange, placeholder, show, onToggle, error }) {
  return (
    <div className="sc-input-wrap">
      <input
        className={`sc-input${error ? ' error' : ''}`}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      <button className="sc-eye" onClick={onToggle} type="button" tabIndex={-1}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}

function StrengthBar({ password }) {
  if (!password) return null
  const level = getPwStrength(password)
  const map = { weak: { w: '33%', bg: '#EF4444', label: 'Weak' }, medium: { w: '66%', bg: '#F59E0B', label: 'Medium' }, strong: { w: '100%', bg: '#22C55E', label: 'Strong' } }
  const { w, bg, label } = map[level]
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ height: 4, borderRadius: 2, background: '#E5E0EB', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: w, background: bg, borderRadius: 2, transition: 'width 0.3s, background 0.3s' }} />
      </div>
      <div style={{ fontSize: 11, color: bg, marginTop: 3, fontWeight: 500 }}>{label}</div>
    </div>
  )
}

function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3400); return () => clearTimeout(t) }, [onClose])
  return (
    <div className={`sc-toast${type === 'error' ? ' error' : ''}`}>
      {type !== 'error' && (
        <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.4)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80', flexShrink: 0, fontSize: 11, fontWeight: 700 }}>✓</span>
      )}
      {message}
    </div>
  )
}

function ConfirmDialog({ open, title, message, confirmText, typeToConfirm, onConfirm, onCancel, loading }) {
  const [typed, setTyped] = useState('')
  useEffect(() => { if (!open) setTyped('') }, [open])
  useEffect(() => {
    function k(e) { if (e.key === 'Escape' && open) onCancel() }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [open, onCancel])
  if (!open) return null
  const ok = typeToConfirm ? typed === typeToConfirm : true
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'sc-overlay-in 0.15s ease-out' }} onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={{ background: '#FFFFFF', border: '1px solid #E5E0EB', borderRadius: 12, padding: 28, maxWidth: 420, width: '90%', animation: 'sc-dialog-in 0.2s ease-out' }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1C0F36', margin: '0 0 8px 0' }}>{title}</h3>
        <p style={{ fontSize: 14, color: '#6B5E7B', margin: '0 0 20px 0', lineHeight: 1.6 }}>{message}</p>
        {typeToConfirm && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: '#6B5E7B', marginBottom: 6 }}>Type <strong style={{ color: '#1C0F36' }}>{typeToConfirm}</strong> to confirm:</div>
            <input className="sc-input" type="text" value={typed} onChange={e => setTyped(e.target.value)} placeholder={typeToConfirm} autoFocus />
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="sc-btn-secondary" onClick={onCancel} type="button" disabled={loading}>Cancel</button>
          <button className="sc-btn-destructive" onClick={onConfirm} disabled={!ok || loading} type="button" style={{ opacity: ok && !loading ? 1 : 0.45, cursor: ok && !loading ? 'pointer' : 'not-allowed' }}>
            {loading ? 'Processing…' : (confirmText || 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   MFA Setup Wizard
───────────────────────────────────────────── */
function MFAWizard({ open, step, qrCode, secret, verifyCode, setVerifyCode, verifyError, enrolling, verifying, recoveryCodes, recoveryConfirmed, setRecoveryConfirmed, onContinue, onVerify, onDone, onClose }) {
  useEffect(() => {
    function k(e) { if (e.key === 'Escape' && open && step !== 3) onClose() }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [open, step, onClose])
  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, animation: 'sc-overlay-in 0.15s ease-out' }} onClick={e => e.target === e.currentTarget && step !== 3 && onClose()}>
      <div style={{ background: '#FFFFFF', border: '1px solid #E5E0EB', borderRadius: 16, width: '100%', maxWidth: 460, animation: 'sc-dialog-in 0.2s ease-out', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '24px 24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 600, color: '#1C0F36', marginBottom: 4 }}>
                {step === 1 && 'Set up two-factor authentication'}
                {step === 2 && 'Verify your authenticator'}
                {step === 3 && 'Save your recovery codes'}
              </div>
              <div style={{ fontSize: 13, color: '#6B5E7B' }}>
                {step === 1 && 'Scan the QR code with your authenticator app'}
                {step === 2 && 'Enter the 6-digit code from your authenticator app'}
                {step === 3 && 'Store these somewhere safe — each code works once'}
              </div>
            </div>
            {step !== 3 && (
              <button className="sc-btn-ghost" onClick={onClose} style={{ padding: '6px 8px', flexShrink: 0 }} type="button">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
          {/* Step dots */}
          <div className="sc-step-dots" style={{ marginBottom: 24 }}>
            {[1, 2, 3].map(s => (
              <div key={s} className={`sc-step-dot${step === s ? ' active' : step > s ? ' done' : ''}`} />
            ))}
          </div>
        </div>

        {/* Step 1 — QR code */}
        {step === 1 && (
          <div style={{ padding: '0 24px 24px' }}>
            {enrolling ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                <div style={{ width: 180, height: 180 }} className="sc-skeleton" />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                <div style={{ width: 180, height: 180, border: '1px solid #E5E0EB', borderRadius: 12, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF' }}>
                  {qrCode && (
                    qrCode.startsWith('data:') || qrCode.startsWith('http')
                      ? <img src={qrCode} alt="2FA QR Code" width={160} height={160} />
                      : <div dangerouslySetInnerHTML={{ __html: qrCode }} style={{ width: 160, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
                  )}
                </div>
                <div style={{ width: '100%' }}>
                  <div style={{ fontSize: 12, color: '#9B91A8', marginBottom: 6, textAlign: 'center' }}>Can&apos;t scan? Enter this code manually:</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F8F7FA', border: '1px solid #E5E0EB', borderRadius: 8, padding: '8px 12px' }}>
                    <span className="sc-mono" style={{ flex: 1, wordBreak: 'break-all', color: '#1C0F36' }}>{secret}</span>
                    <button className="sc-btn-ghost" onClick={() => copyText(secret)} type="button" style={{ padding: '4px 8px', flexShrink: 0 }}>
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
                <button className="sc-btn-primary" onClick={onContinue} style={{ width: '100%' }} type="button">Continue</button>
              </div>
            )}
          </div>
        )}

        {/* Step 2 — Verify code */}
        {step === 2 && (
          <div style={{ padding: '0 24px 24px' }}>
            <Field label="Verification code" error={verifyError}>
              <input
                className={`sc-input${verifyError ? ' error' : ''}`}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={verifyCode}
                onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                style={{ fontSize: 22, letterSpacing: '0.3em', textAlign: 'center', fontFamily: 'Courier New, monospace' }}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && onVerify()}
              />
            </Field>
            <button className="sc-btn-primary" onClick={onVerify} style={{ width: '100%', marginTop: 20 }} disabled={verifyCode.length !== 6 || verifying} type="button">
              {verifying ? 'Verifying…' : 'Verify code'}
            </button>
          </div>
        )}

        {/* Step 3 — Recovery codes */}
        {step === 3 && (
          <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="sc-warning">
              ⚠ Save these codes somewhere safe. Each code can only be used once. Use them if you lose access to your authenticator app.
            </div>
            <div className="sc-code-grid">
              {recoveryCodes.map((code, i) => (
                <div key={i} className="sc-code-item">{code}</div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="sc-btn-secondary" onClick={() => copyText(recoveryCodes.join('\n'))} type="button" style={{ flex: 1, justifyContent: 'center' }}>
                <Copy size={14} /> Copy all
              </button>
              <button className="sc-btn-secondary" onClick={() => downloadCodes(recoveryCodes)} type="button" style={{ flex: 1, justifyContent: 'center' }}>
                <Download size={14} /> Download .txt
              </button>
            </div>
            <label className="sc-checkbox-row" onClick={() => setRecoveryConfirmed(v => !v)}>
              <div className={`sc-checkbox${recoveryConfirmed ? ' checked' : ''}`}>
                {recoveryConfirmed && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <span style={{ fontSize: 14, color: '#1C0F36', lineHeight: 1.5 }}>I&apos;ve saved my recovery codes in a safe place</span>
            </label>
            <button className="sc-btn-primary" onClick={onDone} disabled={!recoveryConfirmed} type="button" style={{ width: '100%', opacity: recoveryConfirmed ? 1 : 0.45, cursor: recoveryConfirmed ? 'pointer' : 'not-allowed' }}>
              Done — 2FA is enabled
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Recovery Codes View Modal
───────────────────────────────────────────── */
function RecoveryCodesModal({ open, codes, loading, onClose, onRegen }) {
  useEffect(() => {
    function k(e) { if (e.key === 'Escape' && open) onClose() }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, animation: 'sc-overlay-in 0.15s ease-out' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#FFFFFF', border: '1px solid #E5E0EB', borderRadius: 16, width: '100%', maxWidth: 460, animation: 'sc-dialog-in 0.2s ease-out', overflow: 'hidden' }}>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 600, color: '#1C0F36', marginBottom: 4 }}>Recovery codes</div>
              <div style={{ fontSize: 13, color: '#6B5E7B' }}>Each code can only be used once.</div>
            </div>
            <button className="sc-btn-ghost" onClick={onClose} style={{ padding: '6px 8px', flexShrink: 0 }} type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
              {Array(10).fill(0).map((_, i) => <div key={i} className="sc-skeleton" style={{ height: 34 }} />)}
            </div>
          ) : codes.length === 0 ? (
            <div style={{ fontSize: 14, color: '#9B91A8', textAlign: 'center', padding: '16px 0' }}>No recovery codes generated yet.</div>
          ) : (
            <div className="sc-code-grid">
              {codes.map((c, i) => <div key={i} className="sc-code-item">{c}</div>)}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            {!loading && codes.length > 0 && (
              <>
                <button className="sc-btn-secondary" onClick={() => copyText(codes.join('\n'))} type="button" style={{ flex: 1, justifyContent: 'center' }}><Copy size={14} /> Copy all</button>
                <button className="sc-btn-secondary" onClick={() => downloadCodes(codes)} type="button" style={{ flex: 1, justifyContent: 'center' }}><Download size={14} /> Download</button>
              </>
            )}
          </div>
          <div style={{ borderTop: '1px solid #F0EDF4', paddingTop: 16 }}>
            <div style={{ fontSize: 13, color: '#9B91A8', marginBottom: 10 }}>Generate a new set of codes — your old ones will stop working immediately.</div>
            <button className="sc-btn-ghost-red" onClick={onRegen} disabled={loading} type="button">{loading ? 'Generating…' : 'Generate new codes'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */
export default function SecurityPage() {
  const [session, setSession]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [toast, setToast]       = useState(null)

  // Password section
  const [currentPw, setCurrentPw]   = useState('')
  const [newPw, setNewPw]           = useState('')
  const [confirmPw, setConfirmPw]   = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew]         = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pwErrors, setPwErrors]     = useState({})
  const [savingPw, setSavingPw]     = useState(false)

  // 2FA section
  const [factors, setFactors]         = useState([])
  const [loadingFactors, setLoadingFactors] = useState(true)

  // Wizard
  const [wizardOpen, setWizardOpen]   = useState(false)
  const [wizardStep, setWizardStep]   = useState(1)
  const [enrollFactorId, setEnrollFactorId] = useState(null)
  const [enrollQrCode, setEnrollQrCode]     = useState('')
  const [enrollSecret, setEnrollSecret]     = useState('')
  const [verifyCode, setVerifyCode]   = useState('')
  const [verifyError, setVerifyError] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState([])
  const [recoveryConfirmed, setRecoveryConfirmed] = useState(false)
  const [enrolling, setEnrolling]     = useState(false)
  const [verifying, setVerifying]     = useState(false)

  // Manage menu
  const [manageOpen, setManageOpen] = useState(false)
  const manageRef = useRef(null)

  // Recovery codes modal
  const [rcOpen, setRcOpen]     = useState(false)
  const [rcCodes, setRcCodes]   = useState([])
  const [rcLoading, setRcLoading] = useState(false)

  // Disable 2FA
  const [disableOpen, setDisableOpen] = useState(false)
  const [disabling, setDisabling]     = useState(false)

  // Sessions
  const [deviceInfo, setDeviceInfo] = useState('This device')
  const [signingOut, setSigningOut] = useState(false)

  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s) { window.location.href = '/login'; return }
      setSession(s)
      if (typeof navigator !== 'undefined') setDeviceInfo(parseDevice(navigator.userAgent))
      setLoading(false)
      loadFactors()
    })
  }, [])

  // Close manage menu on outside click
  useEffect(() => {
    function handler(e) { if (manageRef.current && !manageRef.current.contains(e.target)) setManageOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function loadFactors() {
    setLoadingFactors(true)
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) {
      console.error('[2fa] loadFactors failed', { message: error.message, code: error.code })
    }
    if (!error && data) setFactors(data.totp ?? [])
    setLoadingFactors(false)
  }

  const verifiedFactor = factors.find(f => f.status === 'verified')
  const twoFaEnabled = Boolean(verifiedFactor)

  /* ── Password change ── */
  async function handleChangePassword() {
    const errs = {}
    if (!currentPw) errs.current = 'Required'
    if (newPw.length < 8) errs.new = 'Minimum 8 characters'
    if (newPw && currentPw && newPw === currentPw) errs.new = 'Must differ from current password'
    if (confirmPw !== newPw) errs.confirm = 'Passwords do not match'
    if (Object.keys(errs).length) { setPwErrors(errs); return }

    setSavingPw(true)
    setPwErrors({})

    // Verify current password by re-authenticating
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPw,
    })
    if (authErr) {
      setPwErrors({ current: 'Current password is incorrect' })
      setSavingPw(false)
      return
    }

    const { error: updateErr } = await supabase.auth.updateUser({ password: newPw })
    setSavingPw(false)
    if (updateErr) { showToast(updateErr.message, 'error'); return }

    setCurrentPw(''); setNewPw(''); setConfirmPw('')
    showToast("Password updated. You've been signed out of other sessions.")
  }

  /* ── Enable 2FA: open wizard + enroll ── */
  async function handleOpenWizard() {
    setWizardOpen(true)
    setWizardStep(1)
    setVerifyCode('')
    setVerifyError('')
    setRecoveryCodes([])
    setRecoveryConfirmed(false)
    setEnrolling(true)

    // 1) Re-fetch factors from the server, not from cached React state.
    //    A factor created in another tab or in a previous wizard run that
    //    crashed must be visible before we cleanup.
    const { data: live, error: listErr } = await supabase.auth.mfa.listFactors()
    if (listErr) {
      console.error('[2fa] listFactors failed', listErr)
      showToast(listErr.message || 'Could not read 2FA factors', 'error')
      setEnrolling(false)
      setWizardOpen(false)
      return
    }

    const liveFactors = live?.totp ?? []
    const verified   = liveFactors.find(f => f.status === 'verified')
    const unverified = liveFactors.filter(f => f.status === 'unverified')

    // 2) If a verified factor already exists, refuse to re-enroll.
    if (verified) {
      setFactors(liveFactors)
      setEnrolling(false)
      setWizardOpen(false)
      showToast('2FA is already enabled on this account', 'error')
      return
    }

    // 3) Cleanup orphans: try the user-scoped unenroll first; if that
    //    fails (common at AAL1 for unverified factors), fall back to the
    //    server-side admin DELETE which always succeeds with service-role.
    let needsServerCleanup = false
    for (const f of unverified) {
      const { error: unenrollErr } = await supabase.auth.mfa.unenroll({ factorId: f.id })
      if (unenrollErr) {
        console.warn('[2fa] client unenroll failed, will fall back', {
          factorId: f.id, message: unenrollErr.message, code: unenrollErr.code,
        })
        needsServerCleanup = true
      }
    }

    if (needsServerCleanup) {
      try {
        const res = await fetch('/api/auth/mfa/cleanup', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          console.error('[2fa] server cleanup failed', json)
          showToast(json.error || 'Could not clean up orphaned 2FA factors', 'error')
          setEnrolling(false)
          setWizardOpen(false)
          return
        }
      } catch (e) {
        console.error('[2fa] server cleanup network error', e)
        showToast('Could not clean up orphaned 2FA factors', 'error')
        setEnrolling(false)
        setWizardOpen(false)
        return
      }
    }

    // 4) Enroll. friendlyName must be non-empty: Supabase's UNIQUE
    //    constraint on (user_id, friendly_name) blocks two factors that
    //    share the same name (including ''). 'Authenticator' is what the
    //    user sees in the Manage UI — kept stable across re-enrolls
    //    because cleanup above guarantees no collision.
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Authenticator',
    })
    setEnrolling(false)
    if (error) {
      console.error('[2fa] enroll failed', error)
      showToast(error.message || 'Could not start 2FA enrollment', 'error')
      setWizardOpen(false)
      return
    }
    setEnrollFactorId(data.id)
    setEnrollQrCode(data.totp.qr_code)
    setEnrollSecret(data.totp.secret)
  }

  async function handleVerify() {
    if (verifyCode.length !== 6) { setVerifyError('Enter a 6-digit code'); return }
    setVerifying(true)
    setVerifyError('')
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollFactorId, code: verifyCode })
    setVerifying(false)
    if (error) {
      console.error('[2fa] challengeAndVerify failed', { message: error.message, code: error.code })
      setVerifyError('Invalid code, try again')
      return
    }

    // Generate recovery codes server-side
    const res = await fetch('/api/auth/recovery-codes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const json = await res.json()
    if (!res.ok) { showToast(json.error ?? 'Failed to generate recovery codes', 'error'); return }
    setRecoveryCodes(json.recovery_codes)
    await loadFactors()
    setWizardStep(3)
  }

  function handleWizardDone() {
    setWizardOpen(false)
    showToast('Two-factor authentication enabled')
  }

  /* ── Disable 2FA ── */
  async function handleDisable() {
    setDisabling(true)
    const { error } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactor.id })
    if (error) {
      console.error('[2fa] disable unenroll failed', { message: error.message, code: error.code })
      showToast(error.message || 'Could not disable 2FA', 'error')
      setDisabling(false)
      return
    }

    await fetch('/api/auth/recovery-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ clear: true }),
    })
    await loadFactors()
    setDisableOpen(false)
    setManageOpen(false)
    showToast('Two-factor authentication disabled')
    setDisabling(false)
  }

  /* ── View/regen recovery codes ── */
  async function handleViewCodes() {
    setManageOpen(false)
    setRcOpen(true)
    setRcLoading(true)
    const res = await fetch('/api/auth/recovery-codes', { headers: { Authorization: `Bearer ${session.access_token}` } })
    const json = await res.json()
    setRcCodes(json.recovery_codes ?? [])
    setRcLoading(false)
  }

  async function handleRegenCodes() {
    setRcLoading(true)
    const res = await fetch('/api/auth/recovery-codes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const json = await res.json()
    setRcCodes(json.recovery_codes ?? [])
    setRcLoading(false)
    showToast('New recovery codes generated')
  }

  /* ── Sign out others ── */
  async function handleSignOutOthers() {
    setSigningOut(true)
    const { error } = await supabase.auth.signOut({ scope: 'others' })
    setSigningOut(false)
    if (error) { showToast(error.message, 'error'); return }
    showToast('Signed out of all other devices')
  }

  /* ── Render ── */
  if (loading || !session) {
    return (
      <div className="sc-root">
        <style>{CSS}</style>
        <div style={{ maxWidth: 768, margin: '0 auto', padding: '48px 48px' }}>
          <div className="sc-skeleton" style={{ width: 160, height: 13, marginBottom: 16 }} />
          <div className="sc-skeleton" style={{ width: 220, height: 32, marginBottom: 8 }} />
          <div className="sc-skeleton" style={{ width: 360, height: 14, marginBottom: 40 }} />
          <div className="sc-skeleton" style={{ width: '100%', height: 260, borderRadius: 12, marginBottom: 24 }} />
          <div className="sc-skeleton" style={{ width: '100%', height: 140, borderRadius: 12 }} />
        </div>
      </div>
    )
  }

  return (
    <div className="sc-root">
      <style>{CSS}</style>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <MFAWizard
        open={wizardOpen}
        step={wizardStep}
        qrCode={enrollQrCode}
        secret={enrollSecret}
        verifyCode={verifyCode}
        setVerifyCode={setVerifyCode}
        verifyError={verifyError}
        enrolling={enrolling}
        verifying={verifying}
        recoveryCodes={recoveryCodes}
        recoveryConfirmed={recoveryConfirmed}
        setRecoveryConfirmed={setRecoveryConfirmed}
        onContinue={() => setWizardStep(2)}
        onVerify={handleVerify}
        onDone={handleWizardDone}
        onClose={() => setWizardOpen(false)}
      />

      <RecoveryCodesModal
        open={rcOpen}
        codes={rcCodes}
        loading={rcLoading}
        onClose={() => setRcOpen(false)}
        onRegen={handleRegenCodes}
      />

      <ConfirmDialog
        open={disableOpen}
        title="Disable two-factor authentication"
        message="This will reduce your account security. You won't need a code when signing in."
        confirmText="Disable 2FA"
        typeToConfirm="DISABLE"
        onConfirm={handleDisable}
        onCancel={() => setDisableOpen(false)}
        loading={disabling}
      />

      <div style={{ maxWidth: 768, margin: '0 auto', padding: '48px 48px' }}>
        <SettingsHeader
          breadcrumb={['Settings', 'Personal', 'Password & 2FA']}
          title="Password & 2FA"
          subtitle="Manage your password, two-factor authentication, and active sessions."
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>

          {/* ── Section 1: Change password ── */}
          <div>
            <SectionTitle
              title="Password"
              description="Update your password. Changing it signs you out of all other active sessions."
            />
            <Card footer={
              <button className="sc-btn-primary" onClick={handleChangePassword} disabled={savingPw} type="button">
                {savingPw ? 'Updating…' : 'Update password'}
              </button>
            }>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <Field label="Current password" error={pwErrors.current}>
                  <PwInput value={currentPw} onChange={setCurrentPw} placeholder="Your current password" show={showCurrent} onToggle={() => setShowCurrent(v => !v)} error={pwErrors.current} />
                </Field>
                <Field label="New password" error={pwErrors.new}>
                  <PwInput value={newPw} onChange={setNewPw} placeholder="New password (min 8 characters)" show={showNew} onToggle={() => setShowNew(v => !v)} error={pwErrors.new} />
                  <StrengthBar password={newPw} />
                </Field>
                <Field label="Confirm new password" error={pwErrors.confirm}>
                  <PwInput value={confirmPw} onChange={setConfirmPw} placeholder="Repeat new password" show={showConfirm} onToggle={() => setShowConfirm(v => !v)} error={pwErrors.confirm} />
                </Field>
              </div>
            </Card>
          </div>

          {/* ── Section 2: Two-factor auth ── */}
          <div>
            <SectionTitle
              title="Two-factor authentication"
              description="Add an extra layer of security to your account using an authenticator app."
            />
            <Card>
              {loadingFactors ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="sc-skeleton" style={{ width: 36, height: 36, borderRadius: 8 }} />
                  <div style={{ flex: 1 }}>
                    <div className="sc-skeleton" style={{ width: 80, height: 14, marginBottom: 6 }} />
                    <div className="sc-skeleton" style={{ width: 140, height: 12 }} />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: twoFaEnabled ? 'rgba(34,197,94,0.1)' : '#F8F7FA', border: `1px solid ${twoFaEnabled ? 'rgba(34,197,94,0.25)' : '#E5E0EB'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {twoFaEnabled
                        ? <ShieldCheck size={20} color="#22C55E" strokeWidth={1.75} />
                        : <Shield size={20} color="#9B91A8" strokeWidth={1.75} />
                      }
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: twoFaEnabled ? '#15803D' : '#6B5E7B' }}>
                        {twoFaEnabled ? 'Enabled' : 'Not enabled'}
                      </div>
                      <div style={{ fontSize: 12, color: '#9B91A8', marginTop: 1 }}>
                        {twoFaEnabled ? 'Authenticator app' : 'No second factor configured'}
                      </div>
                    </div>
                  </div>

                  {!twoFaEnabled ? (
                    <button className="sc-btn-primary" onClick={handleOpenWizard} type="button">Enable 2FA</button>
                  ) : (
                    <div style={{ position: 'relative' }} ref={manageRef}>
                      <button className="sc-btn-secondary" onClick={() => setManageOpen(v => !v)} type="button">
                        Manage <ChevronDown size={14} />
                      </button>
                      {manageOpen && (
                        <div className="sc-manage-menu">
                          <button className="sc-menu-item" onClick={handleViewCodes} type="button">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            View recovery codes
                          </button>
                          <button className="sc-menu-item danger" onClick={() => { setManageOpen(false); setDisableOpen(true) }} type="button">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                            Disable 2FA
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* ── Section 3: Active sessions ── */}
          <div>
            <SectionTitle
              title="Active sessions"
              description="Devices currently signed in to your account."
            />
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F0EDF4', border: '1px solid #E5E0EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Monitor size={20} color="#A175FC" strokeWidth={1.75} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#1C0F36' }}>{deviceInfo}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#A175FC', background: 'rgba(161,117,252,0.1)', border: '1px solid rgba(161,117,252,0.2)', borderRadius: 4, padding: '1px 6px' }}>This device</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#9B91A8', marginTop: 2 }}>Signed in as {session.user.email}</div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #F0EDF4', marginTop: 20, paddingTop: 20 }}>
                <div style={{ fontSize: 13, color: '#6B5E7B', marginBottom: 12 }}>
                  Sign out of all browsers and devices except this one. This is useful if you forgot to sign out on a shared device.
                </div>
                <button className="sc-btn-secondary" onClick={handleSignOutOthers} disabled={signingOut} type="button">
                  {signingOut ? 'Signing out…' : 'Sign out of all other devices'}
                </button>
              </div>
            </Card>
          </div>

        </div>
      </div>
    </div>
  )
}
