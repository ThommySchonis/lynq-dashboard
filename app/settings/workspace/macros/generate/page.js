'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import {
  ArrowLeft, ArrowRight, Sparkles, Loader2, AlertCircle, Check,
} from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const BRAND_VOICES = [
  { value: 'Warm & personal',          desc: 'Friendly, warm, expresses care' },
  { value: 'Professional & efficient', desc: 'Direct, clear, polite, no fluff' },
  { value: 'Casual & friendly',        desc: 'Conversational, contractions OK' },
  { value: 'Luxury & elegant',         desc: 'Refined, sophisticated, never casual' },
  { value: 'Playful & fun',            desc: 'Warm with personality, exclamations OK' },
]

const RETURN_SHIPPING = [
  'Customer pays return shipping',
  'We cover all return shipping',
  'Free returns above certain order value',
]

const DAMAGE_POLICY = [
  'We cover return postage + replacement or refund',
  'Customer sends photos first, then we decide',
  'Customer pays return as normal',
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const STEP_TITLES = [
  { title: 'Brand basics',         desc: 'Tell us who you are and what you sell.'         },
  { title: 'Contact & shipping',   desc: 'How customers reach you and track orders.'      },
  { title: 'Returns & refunds',    desc: 'Your policies for returns, refunds, damages.'   },
  { title: 'Final touch',          desc: 'Anything else AI should know about your store.' },
]

const CSS = `
  .gw-root { font-family: 'Rethink Sans', sans-serif; color: #1C0F36; }
  .gw-wrap { max-width: 720px; margin: 0 auto; padding: 32px 40px 48px; }

  .gw-back {
    display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; margin-left: -10px;
    background: none; border: none; color: #6B5E7B; font-size: 13px; font-family: inherit;
    cursor: pointer; border-radius: 6px; transition: background 0.15s, color 0.15s;
  }
  .gw-back:hover { background: #F1EEF5; color: #1C0F36; }

  .gw-progress-wrap { margin: 16px 0 28px; }
  .gw-progress-meta { display: flex; justify-content: space-between; font-size: 12px; color: #9B91A8; margin-bottom: 6px; }
  .gw-progress-bar  { height: 4px; background: #F1EEF5; border-radius: 4px; overflow: hidden; }
  .gw-progress-fill { height: 100%; background: #A175FC; transition: width 0.3s; }

  .gw-step-title { font-size: 22px; font-weight: 600; color: #1C0F36; margin: 0 0 4px; }
  .gw-step-desc  { font-size: 14px; color: #6B5E7B; margin: 0 0 24px; }

  .gw-field { margin-bottom: 18px; }
  .gw-label { display: block; font-size: 13px; font-weight: 500; color: #1C0F36; margin-bottom: 6px; }
  .gw-hint  { margin: 5px 0 0; font-size: 11px; color: #9B91A8; }
  .gw-fielderr { margin: 5px 0 0; font-size: 12px; color: #DC2626; }

  .gw-input, .gw-select, .gw-textarea {
    width: 100%; padding: 9px 12px; border: 1px solid #E5E0EB; border-radius: 8px;
    font-size: 14px; font-family: inherit; color: #1C0F36; outline: none; box-sizing: border-box;
    background: #fff; transition: border-color 0.15s;
  }
  .gw-input:focus, .gw-select:focus, .gw-textarea:focus {
    border-color: #A175FC; box-shadow: 0 0 0 3px rgba(161,117,252,0.15);
  }
  .gw-input.error, .gw-select.error, .gw-textarea.error {
    border-color: #FCA5A5; box-shadow: 0 0 0 3px rgba(239,68,68,0.12);
  }
  .gw-select {
    -webkit-appearance: none; appearance: none; cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%239B91A8' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 10px center;
    padding-right: 32px;
  }
  .gw-textarea { resize: vertical; min-height: 100px; line-height: 1.5; font-family: inherit; }

  /* Single-select cards (radio-style) */
  .gw-options { display: flex; flex-direction: column; gap: 8px; }
  .gw-option {
    display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px;
    border: 2px solid #E5E0EB; border-radius: 10px; background: #fff;
    cursor: pointer; transition: border-color 0.15s, background 0.15s;
  }
  .gw-option:hover { border-color: #C8C0D4; }
  .gw-option.selected { border-color: #A175FC; background: #F7F3FF; }
  .gw-option-radio {
    width: 16px; height: 16px; border-radius: 50%; border: 2px solid #C8C0D4;
    flex-shrink: 0; margin-top: 2px; display: flex; align-items: center; justify-content: center;
    transition: border-color 0.15s;
  }
  .gw-option.selected .gw-option-radio { border-color: #A175FC; }
  .gw-option.selected .gw-option-radio::after {
    content: ''; width: 8px; height: 8px; border-radius: 50%; background: #A175FC;
  }
  .gw-option-text { display: flex; flex-direction: column; gap: 2px; }
  .gw-option-name { font-size: 14px; font-weight: 500; color: #1C0F36; }
  .gw-option-desc { font-size: 12px; color: #9B91A8; }

  .gw-actions { display: flex; gap: 8px; justify-content: space-between; margin-top: 32px; }

  .gw-error-bar {
    display: flex; align-items: flex-start; gap: 10px; padding: 12px 16px;
    background: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px;
    margin-bottom: 16px; font-size: 13px; color: #DC2626;
  }

  .btn-primary {
    display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px;
    background: #A175FC; color: #fff; border: none; border-radius: 8px;
    font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer;
    transition: background 0.15s; white-space: nowrap;
  }
  .btn-primary:hover:not(:disabled) { background: #8B5CF6; }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-secondary {
    display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px;
    background: #fff; color: #1C0F36; border: 1px solid #E5E0EB; border-radius: 8px;
    font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer;
  }
  .btn-secondary:hover:not(:disabled) { background: #F8F7FA; }
  .btn-secondary:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Generating overlay */
  .gw-generating {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 80px 24px; text-align: center;
  }
  .gw-gen-icon {
    width: 64px; height: 64px; border-radius: 16px; background: #EDE5FE;
    display: flex; align-items: center; justify-content: center; color: #A175FC;
    margin-bottom: 16px; position: relative;
  }
  .gw-gen-icon .spin { color: #A175FC; }
  .gw-gen-title { font-size: 20px; font-weight: 600; color: #1C0F36; margin: 0 0 6px; }
  .gw-gen-desc  { font-size: 14px; color: #6B5E7B; margin: 0; max-width: 380px; line-height: 1.55; }

  .gw-loading-card {
    display: flex; align-items: center; justify-content: center;
    padding: 80px 24px; gap: 10px; color: #9B91A8; font-size: 14px;
  }

  .spin { animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`

const EMPTY = {
  store_name: '', what_sells: '', brand_voice: '',
  support_email: '', signature: '', tracking_link: '',
  return_days: 30, return_shipping: '', damage_policy: '',
  extra_notes: '',
}

export default function GenerateWizardPage() {
  const router = useRouter()

  const [step, setStep]       = useState(0)            // 0..3
  const [answers, setAnswers] = useState(EMPTY)
  const [loading, setLoading] = useState(true)         // initial fetch (prefill)
  const [errors, setErrors]   = useState({})           // { field: string }
  const [submitting, setSubmitting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [topError, setTopError]     = useState(null)

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }, [])

  // Prefill from existing onboarding (so "Edit details" works)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const token = await getToken()
      if (!token) { setLoading(false); return }
      const res  = await fetch('/api/macros/onboarding', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json().catch(() => ({}))
      if (cancelled) return
      if (res.ok && data.onboarding?.answers) {
        setAnswers(prev => ({ ...prev, ...data.onboarding.answers }))
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [getToken])

  function set(k, v) {
    setAnswers(prev => ({ ...prev, [k]: v }))
    if (errors[k]) setErrors(prev => { const n = { ...prev }; delete n[k]; return n })
  }

  function validateStep(s) {
    const e = {}
    if (s === 0) {
      if (!answers.store_name.trim())  e.store_name  = 'Required'
      if (!answers.what_sells.trim())  e.what_sells  = 'Required'
      if (!answers.brand_voice)        e.brand_voice = 'Pick one'
    } else if (s === 1) {
      if (!answers.support_email.trim()) e.support_email = 'Required'
      else if (!EMAIL_RE.test(answers.support_email.trim())) e.support_email = 'Invalid email'
      if (!answers.signature.trim()) e.signature = 'Required'
    } else if (s === 2) {
      const days = Number(answers.return_days)
      if (!Number.isFinite(days) || days < 1 || days > 365) e.return_days = '1–365 days'
      if (!answers.return_shipping) e.return_shipping = 'Pick one'
      if (!answers.damage_policy)   e.damage_policy   = 'Pick one'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function next() {
    if (validateStep(step)) setStep(s => Math.min(3, s + 1))
  }
  function back() {
    setStep(s => Math.max(0, s - 1))
    setTopError(null)
  }

  async function handleSubmit() {
    // Validate every step (defensive)
    for (let s = 0; s <= 3; s++) {
      if (!validateStep(s)) { setStep(s); return }
    }
    setTopError(null)
    setSubmitting(true)

    // 1. Save onboarding answers
    const token = await getToken()
    if (!token) { setSubmitting(false); setTopError('Not authenticated. Please refresh and try again.'); return }

    const saveRes = await fetch('/api/macros/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ answers }),
    })
    if (!saveRes.ok) {
      const body = await saveRes.json().catch(() => ({}))
      setSubmitting(false)
      setTopError(body.error || "Couldn't save your answers. Try again.")
      return
    }

    setSubmitting(false)
    setGenerating(true)
    await runGenerate()
  }

  async function runGenerate() {
    setTopError(null)
    setGenerating(true)
    const token = await getToken()
    if (!token) { setGenerating(false); setTopError('Not authenticated. Please refresh.'); return }

    const res  = await fetch('/api/macros/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok || !data.ok) {
      setGenerating(false)
      setTopError(data.error || 'Generation failed. Try again.')
      return
    }

    // Land on macros list with success toast via sessionStorage
    try {
      sessionStorage.setItem('mp:lastToast', JSON.stringify({
        msg:  `${data.count} macros created`,
        type: 'ok',
      }))
    } catch (_) {}
    router.push('/settings/workspace/macros')
  }

  // ── render ──
  if (loading) {
    return (
      <div className="gw-root">
        <style>{CSS}</style>
        <div className="gw-wrap">
          <div className="gw-loading-card">
            <Loader2 size={18} strokeWidth={1.75} className="spin" />
            Loading…
          </div>
        </div>
      </div>
    )
  }

  if (generating) {
    return (
      <div className="gw-root">
        <style>{CSS}</style>
        <div className="gw-wrap">
          <div className="gw-generating">
            <div className="gw-gen-icon">
              <Loader2 size={32} strokeWidth={1.75} className="spin" />
            </div>
            <h2 className="gw-gen-title">Creating your macros…</h2>
            <p className="gw-gen-desc">
              AI is reviewing your store details and crafting personalized responses.
              This takes about 30–60 seconds.
            </p>
            {topError && (
              <div className="gw-error-bar" style={{ marginTop: 24, maxWidth: 420 }}>
                <AlertCircle size={16} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{topError}</span>
              </div>
            )}
            {topError && (
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="btn-secondary" onClick={() => { setGenerating(false); setTopError(null) }}>
                  Edit answers
                </button>
                <button className="btn-primary" onClick={runGenerate}>
                  <Sparkles size={14} strokeWidth={1.75} />
                  Try again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="gw-root">
      <style>{CSS}</style>
      <div className="gw-wrap">
        <button className="gw-back" onClick={() => router.push('/settings/workspace/macros')}>
          <ArrowLeft size={14} strokeWidth={1.75} /> Back to macros
        </button>

        <div className="gw-progress-wrap">
          <div className="gw-progress-meta">
            <span>Step {step + 1} of 4</span>
            <span>{STEP_TITLES[step].title}</span>
          </div>
          <div className="gw-progress-bar">
            <div className="gw-progress-fill" style={{ width: `${((step + 1) / 4) * 100}%` }} />
          </div>
        </div>

        <h1 className="gw-step-title">{STEP_TITLES[step].title}</h1>
        <p className="gw-step-desc">{STEP_TITLES[step].desc}</p>

        {topError && (
          <div className="gw-error-bar">
            <AlertCircle size={16} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{topError}</span>
          </div>
        )}

        {/* ── STEP 1 ── */}
        {step === 0 && (
          <>
            <div className="gw-field">
              <label className="gw-label" htmlFor="q-store-name">What&rsquo;s your store called?</label>
              <input
                id="q-store-name"
                className={`gw-input${errors.store_name ? ' error' : ''}`}
                type="text"
                placeholder="e.g. Elise Mimosa"
                value={answers.store_name}
                onChange={e => set('store_name', e.target.value)}
                maxLength={200}
                autoFocus
              />
              {errors.store_name && <p className="gw-fielderr">{errors.store_name}</p>}
            </div>

            <div className="gw-field">
              <label className="gw-label" htmlFor="q-what-sells">What kind of products do you sell?</label>
              <input
                id="q-what-sells"
                className={`gw-input${errors.what_sells ? ' error' : ''}`}
                type="text"
                placeholder="e.g. Women's fashion, sustainable beauty, electronics"
                value={answers.what_sells}
                onChange={e => set('what_sells', e.target.value)}
                maxLength={500}
              />
              {errors.what_sells
                ? <p className="gw-fielderr">{errors.what_sells}</p>
                : <p className="gw-hint">Be specific — this shapes the macro tone</p>
              }
            </div>

            <div className="gw-field">
              <label className="gw-label">How does your brand speak?</label>
              <div className="gw-options">
                {BRAND_VOICES.map(v => (
                  <div
                    key={v.value}
                    className={`gw-option${answers.brand_voice === v.value ? ' selected' : ''}`}
                    onClick={() => set('brand_voice', v.value)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); set('brand_voice', v.value) } }}
                  >
                    <span className="gw-option-radio" />
                    <span className="gw-option-text">
                      <span className="gw-option-name">{v.value}</span>
                      <span className="gw-option-desc">{v.desc}</span>
                    </span>
                  </div>
                ))}
              </div>
              {errors.brand_voice && <p className="gw-fielderr">{errors.brand_voice}</p>}
            </div>
          </>
        )}

        {/* ── STEP 2 ── */}
        {step === 1 && (
          <>
            <div className="gw-field">
              <label className="gw-label" htmlFor="q-support-email">What&rsquo;s your support email?</label>
              <input
                id="q-support-email"
                className={`gw-input${errors.support_email ? ' error' : ''}`}
                type="email"
                placeholder="e.g. hello@yourstore.com"
                value={answers.support_email}
                onChange={e => set('support_email', e.target.value)}
                maxLength={200}
                autoFocus
              />
              {errors.support_email && <p className="gw-fielderr">{errors.support_email}</p>}
            </div>

            <div className="gw-field">
              <label className="gw-label" htmlFor="q-signature">How do you sign your emails?</label>
              <input
                id="q-signature"
                className={`gw-input${errors.signature ? ' error' : ''}`}
                type="text"
                placeholder="e.g. With warmth, Elise Mimosa"
                value={answers.signature}
                onChange={e => set('signature', e.target.value)}
                maxLength={300}
              />
              {errors.signature && <p className="gw-fielderr">{errors.signature}</p>}
            </div>

            <div className="gw-field">
              <label className="gw-label" htmlFor="q-tracking">Where can customers track orders?</label>
              <input
                id="q-tracking"
                className="gw-input"
                type="text"
                placeholder="e.g. https://yourstore.com/apps/parcelpanel"
                value={answers.tracking_link}
                onChange={e => set('tracking_link', e.target.value)}
                maxLength={500}
              />
              <p className="gw-hint">Leave blank if you don&rsquo;t have one</p>
            </div>
          </>
        )}

        {/* ── STEP 3 ── */}
        {step === 2 && (
          <>
            <div className="gw-field">
              <label className="gw-label" htmlFor="q-return-days">How many days do customers have to return?</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  id="q-return-days"
                  className={`gw-input${errors.return_days ? ' error' : ''}`}
                  type="number"
                  min={1}
                  max={365}
                  value={answers.return_days}
                  onChange={e => set('return_days', e.target.value === '' ? '' : Number(e.target.value))}
                  style={{ maxWidth: 120 }}
                  autoFocus
                />
                <span style={{ fontSize: 14, color: '#6B5E7B' }}>days</span>
              </div>
              {errors.return_days && <p className="gw-fielderr">{errors.return_days}</p>}
            </div>

            <div className="gw-field">
              <label className="gw-label">Who pays return shipping?</label>
              <div className="gw-options">
                {RETURN_SHIPPING.map(v => (
                  <div
                    key={v}
                    className={`gw-option${answers.return_shipping === v ? ' selected' : ''}`}
                    onClick={() => set('return_shipping', v)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); set('return_shipping', v) } }}
                  >
                    <span className="gw-option-radio" />
                    <span className="gw-option-text">
                      <span className="gw-option-name">{v}</span>
                    </span>
                  </div>
                ))}
              </div>
              {errors.return_shipping && <p className="gw-fielderr">{errors.return_shipping}</p>}
            </div>

            <div className="gw-field">
              <label className="gw-label">What if an item arrives damaged?</label>
              <div className="gw-options">
                {DAMAGE_POLICY.map(v => (
                  <div
                    key={v}
                    className={`gw-option${answers.damage_policy === v ? ' selected' : ''}`}
                    onClick={() => set('damage_policy', v)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); set('damage_policy', v) } }}
                  >
                    <span className="gw-option-radio" />
                    <span className="gw-option-text">
                      <span className="gw-option-name">{v}</span>
                    </span>
                  </div>
                ))}
              </div>
              {errors.damage_policy && <p className="gw-fielderr">{errors.damage_policy}</p>}
            </div>
          </>
        )}

        {/* ── STEP 4 ── */}
        {step === 3 && (
          <div className="gw-field">
            <label className="gw-label" htmlFor="q-extra">Other policies, store quirks, or things AI should know</label>
            <textarea
              id="q-extra"
              className="gw-textarea"
              placeholder="e.g. Size exchanges cost £15 / We process orders in 1-3 days / We offer partial refunds 10-50% as alternatives to returns"
              value={answers.extra_notes}
              onChange={e => set('extra_notes', e.target.value)}
              maxLength={2000}
              rows={6}
              autoFocus
            />
            <p className="gw-hint">The more context, the better your macros</p>
          </div>
        )}

        <div className="gw-actions">
          <button
            className="btn-secondary"
            onClick={back}
            disabled={step === 0 || submitting}
          >
            <ArrowLeft size={14} strokeWidth={1.75} />
            Back
          </button>

          {step < 3 ? (
            <button className="btn-primary" onClick={next}>
              Next
              <ArrowRight size={14} strokeWidth={1.75} />
            </button>
          ) : (
            <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting
                ? <><Loader2 size={14} strokeWidth={1.75} className="spin" /> Saving…</>
                : <><Sparkles size={14} strokeWidth={1.75} /> Generate macros</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
