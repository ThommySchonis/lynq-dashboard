'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

// ── Styles ────────────────────────────────────────────────────────────────────

const CSS = `
  @keyframes fadeUp    { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeInUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn    { from{opacity:0} to{opacity:1} }
  @keyframes slideUp   { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
  @keyframes checkPop  { 0%{transform:scale(0)} 65%{transform:scale(1.18)} 100%{transform:scale(1)} }

  @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}

  .sv-root *  { box-sizing:border-box;margin:0;padding:0 }
  .sv-root    { font-family:'Switzer',-apple-system,BlinkMacSystemFont,sans-serif;-webkit-font-smoothing:antialiased }
  .sv-scroll::-webkit-scrollbar       { width:3px }
  .sv-scroll::-webkit-scrollbar-track { background:transparent }
  .sv-scroll::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.12);border-radius:2px }

  .svc-card {
    background:#FFFFFF;
    border:1px solid rgba(0,0,0,0.07);
    border-radius:12px;
    padding:24px;
    display:flex;flex-direction:column;
    position:relative;overflow:hidden;
    transition:all 0.2s ease;
  }
  .svc-card:hover {
    transform:translateY(-2px);
    box-shadow:0 8px 32px rgba(0,0,0,0.10);
    border-color:rgba(0,0,0,0.12);
  }

  .req-btn {
    width:100%;height:42px;padding:0 20px;border-radius:8px;
    font-size:13px;font-weight:600;letter-spacing:-0.01em;cursor:pointer;
    font-family:inherit;
    transition:all 0.15s ease;
    background:#0F0F10;color:#fff;border:none;
    margin-top:16px;
  }
  .req-btn:hover { background:#1a1a1a;box-shadow:0 4px 12px rgba(0,0,0,0.15) }

  .modal-overlay {
    position:fixed;inset:0;z-index:100;
    background:rgba(0,0,0,0.5);
    backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
    display:flex;align-items:center;justify-content:center;
    padding:20px;
    animation:fadeIn .18s ease both;
  }
  .modal-card {
    background:var(--bg-surface);
    border:1px solid var(--border);
    border-radius:22px;padding:36px;
    max-width:480px;width:100%;
    animation:slideUp .28s cubic-bezier(.16,1,.3,1) both;
    position:relative;
    box-shadow:0 32px 80px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.07);
  }

  .close-btn {
    position:absolute;top:16px;right:16px;
    background:none;border:none;color:var(--text-3);
    cursor:pointer;padding:6px;border-radius:8px;
    display:flex;align-items:center;justify-content:center;
    transition:color .15s,background .15s;
  }
  .close-btn:hover { color:#fff;background:var(--bg-surface-2) }

  .tel-input {
    width:100%;padding:12px 14px;
    background:var(--bg-input);
    border:1px solid var(--border);
    border-radius:10px;color:var(--text-1);
    font-size:13.5px;font-family:inherit;
    box-sizing:border-box;
    transition:border-color .15s;outline:none;
  }
  .tel-input::placeholder { color:var(--text-3) }
  .tel-input:focus { border-color:var(--border-hover) }

  .msg-input {
    width:100%;padding:12px 14px;
    background:var(--bg-input);
    border:1px solid var(--border);
    border-radius:10px;color:var(--text-1);
    font-size:13.5px;font-family:inherit;
    resize:none;min-height:90px;
    box-sizing:border-box;
    transition:border-color .15s;outline:none;
    line-height:1.65;
  }
  .msg-input::placeholder { color:var(--text-3) }
  .msg-input:focus { border-color:var(--border-hover) }

  .send-btn {
    width:100%;margin-top:16px;padding:13px 20px;
    border-radius:11px;border:none;
    background:#111111;color:#fff;
    font-size:13.5px;font-weight:700;cursor:pointer;
    font-family:inherit;letter-spacing:.015em;
    transition:background .15s;
  }
  .send-btn:hover:not(:disabled) { background:#333333 }
  .send-btn:disabled { opacity:.55;cursor:not-allowed }
`

// ── Icons (20px, strokeWidth 1.75, dynamic color) ─────────────────────────────

function mkIcon(paths) {
  return (color) => (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {paths}
    </svg>
  )
}

const Icons = {
  headset:    mkIcon(<><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></>),
  shield:     mkIcon(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>),
  package:    mkIcon(<><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>),
  barchart2:  mkIcon(<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></>),
  graduation: mkIcon(<><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></>),
}

// ── Service data ──────────────────────────────────────────────────────────────

const SERVICES = [
  {
    id: 'customer_service_agent',
    title: 'Customer Service Agent',
    badge: { label: 'Most Popular', color: '#FFFFFF', bg: '#0F0F10' },
    topGradient: 'linear-gradient(90deg, #6366F1, #8B5CF6)',
    iconBg: 'rgba(99,102,241,0.07)',
    iconColor: '#6366F1',
    icon: Icons.headset,
    description: 'A trained specialist who handles all incoming customer inquiries — tracking, refunds, returns, and general support. Fully onboarded to your brand voice and policies.',
    features: ['100+ tickets handled daily', 'Trained on your brand voice & policies', 'Gorgias, Zendesk & Re:amaze certified'],
  },
  {
    id: 'dispute_manager',
    title: 'Dispute Manager',
    topGradient: 'linear-gradient(90deg, #EF4444, #F87171)',
    iconBg: 'rgba(239,68,68,0.07)',
    iconColor: '#EF4444',
    icon: Icons.shield,
    description: 'An expert in handling chargebacks, payment disputes, and escalated cases. Protects your revenue and keeps your chargeback rate under control.',
    features: ['Chargeback & dispute resolution', 'Revenue protection strategy', 'Stripe, PayPal & Klarna specialist'],
  },
  {
    id: 'supply_chain_manager',
    title: 'Supply Chain Manager',
    topGradient: 'linear-gradient(90deg, #10B981, #34D399)',
    iconBg: 'rgba(16,185,129,0.07)',
    iconColor: '#10B981',
    icon: Icons.package,
    description: 'Oversees supplier relationships, order fulfillment, stock management, and shipping performance. Keeps your operations running without bottlenecks.',
    features: ['Supplier & vendor management', 'Inventory & stock optimization', 'Fulfillment & shipping oversight'],
  },
  {
    id: 'senior_backend_manager',
    title: 'Senior Backend Manager',
    topGradient: 'linear-gradient(90deg, #F59E0B, #FCD34D)',
    iconBg: 'rgba(245,158,11,0.07)',
    iconColor: '#F59E0B',
    icon: Icons.barchart2,
    description: 'Manages your entire CS operation end-to-end. Sets up systems, leads the team, handles escalations, and reports directly to you.',
    features: ['Full CS operation ownership', 'Team setup, lead & escalation mgmt', 'Weekly direct-to-you reporting'],
  },
]

const TRAIN_SERVICE = {
  id: 'train_existing_team',
  title: 'Train Your Existing Team',
  badge: { label: 'New', color: '#2563EB', bg: '#EFF6FF', border: 'rgba(59,130,246,0.2)' },
  topGradient: 'linear-gradient(90deg, #3B82F6, #60A5FA)',
  iconBg: 'rgba(59,130,246,0.07)',
  iconColor: '#3B82F6',
  icon: Icons.graduation,
  description: "Upskill your in-house team with Lynq & Flow's proven e-commerce CS frameworks. We deliver structured training sessions, battle-tested playbooks, and ongoing coaching to bring your team to agency-level performance.",
  features: [
    'Custom training program built for your brand',
    'Proven e-commerce CS playbooks & frameworks',
    'Live training sessions with your team',
    'Ongoing coaching & performance tracking',
  ],
}

const GUARANTEE_ITEMS = [
  'Dedicated trainer assigned to your account',
  '2-week personal onboarding included',
  'Daily performance report sent directly to you',
]

// ── Sub-components ────────────────────────────────────────────────────────────

function CheckIcon({ size = 14, color = '#10B981' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

function ShieldSmIcon({ color }) {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}

function GuaranteeBlock({ iconColor = '#10B981' }) {
  return (
    <div style={{ background: '#F9F8FF', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 8, padding: '14px 16px', margin: '16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <ShieldSmIcon color={iconColor} />
        <span style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.1em' }}>Our Guarantee</span>
      </div>
      {GUARANTEE_ITEMS.map(item => (
        <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <CheckIcon size={13} color="#10B981" />
          <span style={{ fontSize: 12, color: '#374151' }}>{item}</span>
        </div>
      ))}
    </div>
  )
}

function ServiceCard({ svc, i, onRequest }) {
  return (
    <div className="svc-card" style={{ animation: `fadeInUp 0.5s ease ${i * 0.07}s forwards`, opacity: 0 }}>
      {/* Colored top border */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: svc.topGradient }} />

      {/* Badge top-right */}
      {svc.badge && (
        <span style={{
          position: 'absolute', top: 20, right: 20,
          display: 'inline-flex', alignItems: 'center',
          padding: '3px 10px', borderRadius: 20,
          fontSize: 10, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase',
          color: svc.badge.color, background: svc.badge.bg,
          border: svc.badge.border ? `1px solid ${svc.badge.border}` : 'none',
        }}>{svc.badge.label}</span>
      )}

      {/* Icon */}
      <div style={{ width: 40, height: 40, borderRadius: 10, background: svc.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        {svc.icon(svc.iconColor)}
      </div>

      {/* Title */}
      <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0F0F10', letterSpacing: '-0.01em', marginBottom: 8 }}>{svc.title}</h2>

      {/* Description */}
      <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 16, flex: 1 }}>{svc.description}</p>

      {/* Feature list */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {svc.features.map(f => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <CheckIcon size={14} color={svc.iconColor} />
            <span style={{ fontSize: 13, color: '#374151' }}>{f}</span>
          </div>
        ))}
      </div>

      <GuaranteeBlock iconColor={svc.iconColor} />

      <button className="req-btn" onClick={onRequest}>
        Request More Info
      </button>
    </div>
  )
}

// ── Modal components ──────────────────────────────────────────────────────────

function InquiryForm({ service, phone, setPhone, message, setMessage, onSubmit, submitting, error, onClose }) {
  const isGeneral = service.id === 'general'
  const iconBg    = service.iconBg || 'var(--bg-surface-2)'
  const iconColor = service.iconColor || '#555555'
  return (
    <>
      <button className="close-btn" onClick={onClose} aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      <div style={{ marginBottom: 24 }}>
        {!isGeneral && service.icon ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: iconBg, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {typeof service.icon === 'function' ? service.icon(iconColor) : service.icon}
            </div>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 3 }}>Service Inquiry</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.03em', lineHeight: 1.2 }}>{service.title}</h3>
            </div>
          </div>
        ) : (
          <div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.04em', marginBottom: 6 }}>Let's talk</h3>
            <p style={{ fontSize: 13.5, color: 'var(--text-2)' }}>Tell us what you're looking for and we'll find the right fit.</p>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 9, background: 'var(--bg-surface-2)', border: '1px solid var(--border)', marginBottom: 24 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>We reply within <strong style={{ color: 'var(--text-2)' }}>24 hours</strong></span>
      </div>

      <form onSubmit={onSubmit}>
        <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 7 }}>
          WhatsApp number <span style={{ color: '#f87171', fontWeight: 800 }}>*</span>
        </label>
        <input type="tel" className="tel-input" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="+31 6 12345678" style={{ marginBottom: 18 }} />

        <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 7 }}>
          Your question <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
        </label>
        <textarea className="msg-input" value={message} onChange={e => setMessage(e.target.value)}
          placeholder={isGeneral ? "What are you looking for? Any specific roles or challenges you're facing…" : "What would you like to know about this service?"} />

        {error && (
          <div style={{ fontSize: 12.5, color: '#f87171', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}

        <button type="submit" className="send-btn" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send Request →'}
        </button>
      </form>
    </>
  )
}

function SuccessState({ onClose, serviceName }) {
  return (
    <div style={{ textAlign: 'center', padding: '12px 0 8px' }}>
      <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'rgba(74,222,128,0.1)', border: '1.5px solid rgba(74,222,128,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px', animation: 'checkPop .45s cubic-bezier(.16,1,.3,1) both' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.04em', marginBottom: 8 }}>Request sent!</h3>
      {serviceName && serviceName !== 'General Inquiry' && (
        <div style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 12px', borderRadius: 100, background: 'var(--bg-surface-2)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-2)', marginBottom: 14 }}>
          {serviceName}
        </div>
      )}
      <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, maxWidth: 320, margin: '0 auto 30px' }}>
        Your inquiry is with the Lynq & Flow team. We'll reach out within <strong style={{ color: 'var(--text-2)' }}>24 hours</strong>.
      </p>
      <button
        onClick={onClose}
        style={{ padding: '11px 30px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'background .15s' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-input)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface-2)' }}>
        Close
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ServicesPage() {
  const [activeService, setActiveService] = useState(null)
  const [message, setMessage]             = useState('')
  const [phone, setPhone]                 = useState('')
  const [submitting, setSubmitting]       = useState(false)
  const [submitted, setSubmitted]         = useState(false)
  const [error, setError]                 = useState('')
  const [userId, setUserId]               = useState(null)
  const [userEmail, setUserEmail]         = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id)
        setUserEmail(session.user.email || '')
      }
    })
    const onKey = (e) => { if (e.key === 'Escape') setActiveService(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function openModal(svc) {
    setActiveService(svc)
    setMessage('')
    setPhone('')
    setSubmitted(false)
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!userId) return
    setSubmitting(true)
    setError('')
    const { error: dbErr } = await supabase.from('service_inquiries').insert({
      user_id:      userId,
      client_email: userEmail,
      service:      activeService.title,
      message:      message.trim() || null,
      phone_number: phone.trim() || null,
    })
    setSubmitting(false)
    if (dbErr) setError(dbErr.message)
    else setSubmitted(true)
  }

  return (
    <div className="sv-root" style={{ display: 'flex', minHeight: '100vh', background: '#F9F8FF', color: 'var(--text-1)' }}>
      <style>{CSS}</style>
      <Sidebar />

      <main className="sv-scroll" style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#F9F8FF', position: 'relative', scrollbarWidth: 'thin' }}>
        <div style={{ maxWidth: 840, margin: '0 auto' }}>

          {/* ── Header ── */}
          <div style={{ animation: 'fadeUp .4s ease both', marginBottom: 32 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 10 }}>
              Services
            </div>
            <h1 className="animate-fade-in" style={{ fontSize: 20, fontWeight: 700, color: '#0F0F10', letterSpacing: '-0.02em', marginBottom: 8 }}>Grow Your Team</h1>
            <p style={{ fontSize: 14, color: '#6B7280', maxWidth: 480, lineHeight: 1.6 }}>
              World-class e-commerce specialists, trained to your brand standards and ready to perform from day one.
            </p>
          </div>

          {/* ── 2-column grid ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {SERVICES.map((svc, i) => (
              <ServiceCard key={svc.id} svc={svc} i={i} onRequest={() => openModal(svc)} />
            ))}
          </div>

          {/* ── Train Your Team — full-width ── */}
          <div style={{ marginBottom: 16 }}>
            <ServiceCard svc={TRAIN_SERVICE} i={4} onRequest={() => openModal(TRAIN_SERVICE)} />
          </div>

          {/* ── Bottom CTA ── */}
          <div style={{ animation: 'fadeUp .5s ease .42s both', marginBottom: 40 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
              padding: '20px 24px', borderRadius: 12,
              background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)',
            }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#0F0F10', marginBottom: 4 }}>Not sure which role you need?</p>
                <p style={{ fontSize: 13, color: '#6B7280' }}>We'll help you figure out the perfect fit.</p>
              </div>
              <button
                onClick={() => openModal({ id: 'general', title: 'General Inquiry', icon: null })}
                style={{ padding: '0 20px', height: 40, borderRadius: 8, background: '#0F0F10', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all .15s ease' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#1a1a1a' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#0F0F10' }}>
                Talk to Us →
              </button>
            </div>
          </div>

        </div>
      </main>

      {/* ── Inquiry Modal ── */}
      {activeService && (
        <div className="modal-overlay" onClick={() => setActiveService(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            {submitted
              ? <SuccessState onClose={() => setActiveService(null)} serviceName={activeService.title} />
              : <InquiryForm
                  service={activeService}
                  phone={phone}
                  setPhone={setPhone}
                  message={message}
                  setMessage={setMessage}
                  onSubmit={handleSubmit}
                  submitting={submitting}
                  error={error}
                  onClose={() => setActiveService(null)}
                />
            }
          </div>
        </div>
      )}
    </div>
  )
}
