'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

// ── Styles ────────────────────────────────────────────────────────────────────

const CSS = `
  @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
  @keyframes slideUp { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
  @keyframes checkPop{ 0%{transform:scale(0)} 65%{transform:scale(1.18)} 100%{transform:scale(1)} }

  @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}

  .sv-root *  { box-sizing:border-box;margin:0;padding:0 }
  .sv-root    { font-family:'Switzer',-apple-system,BlinkMacSystemFont,sans-serif;-webkit-font-smoothing:antialiased }
  .sv-scroll::-webkit-scrollbar       { width:3px }
  .sv-scroll::-webkit-scrollbar-track { background:transparent }
  .sv-scroll::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.12);border-radius:2px }

  .svc-card {
    background:#FFFFFF;
    border:1px solid rgba(0,0,0,0.07);
    border-radius:10px;
    padding:24px;
    display:flex;flex-direction:column;
    position:relative;overflow:hidden;
  }

  .req-btn {
    width:100%;height:40px;padding:0 20px;border-radius:8px;
    font-size:13px;font-weight:600;cursor:pointer;
    font-family:inherit;
    transition:background .15s;
    background:#111111;color:#fff;border:none;
    margin-top:16px;
  }
  .req-btn:hover { background:#333333 }

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

// ── Icon ──────────────────────────────────────────────────────────────────────

const ICON_COLOR = '#555555'
const ICON_SIZE  = 18

const Icons = {
  headset: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={ICON_COLOR} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
      <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
    </svg>
  ),
  shield: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={ICON_COLOR} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  truck: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={ICON_COLOR} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13"/>
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
      <circle cx="5.5" cy="18.5" r="2.5"/>
      <circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  ),
  sliders: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={ICON_COLOR} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
      <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
      <line x1="1" y1="14" x2="7" y2="14"/>
      <line x1="9" y1="8" x2="15" y2="8"/>
      <line x1="17" y1="16" x2="23" y2="16"/>
    </svg>
  ),
  graduation: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={ICON_COLOR} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
      <path d="M6 12v5c3 3 9 3 12 0v-5"/>
    </svg>
  ),
}

// ── Service data ──────────────────────────────────────────────────────────────

const SERVICES = [
  {
    id: 'customer_service_agent',
    title: 'Customer Service Agent',
    badge: { label: 'Most Popular', color: '#FFFFFF', bg: '#111111', borderRadius: 4 },
    description: 'A trained specialist who handles all incoming customer inquiries — tracking, refunds, returns, and general support. Fully onboarded to your brand voice and policies.',
    features: ['100+ tickets handled daily', 'Trained on your brand voice & policies', 'Gorgias, Zendesk & Re:amaze certified'],
    icon: Icons.headset,
  },
  {
    id: 'dispute_manager',
    title: 'Dispute Manager',
    description: 'An expert in handling chargebacks, payment disputes, and escalated cases. Protects your revenue and keeps your chargeback rate under control.',
    features: ['Chargeback & dispute resolution', 'Revenue protection strategy', 'Stripe, PayPal & Klarna specialist'],
    icon: Icons.shield,
  },
  {
    id: 'supply_chain_manager',
    title: 'Supply Chain Manager',
    description: 'Oversees supplier relationships, order fulfillment, stock management, and shipping performance. Keeps your operations running without bottlenecks.',
    features: ['Supplier & vendor management', 'Inventory & stock optimization', 'Fulfillment & shipping oversight'],
    icon: Icons.truck,
  },
  {
    id: 'senior_backend_manager',
    title: 'Senior Backend Manager',
    description: 'Manages your entire CS operation end-to-end. Sets up systems, leads the team, handles escalations, and reports directly to you.',
    features: ['Full CS operation ownership', 'Team setup, lead & escalation mgmt', 'Weekly direct-to-you reporting'],
    icon: Icons.sliders,
  },
]

const TRAIN_SERVICE = {
  id: 'train_existing_team',
  title: 'Train Your Existing Team',
  badge: { label: 'New', color: '#555555', bg: '#F5F5F5', border: 'rgba(0,0,0,0.08)', borderRadius: 4 },
  description: "Upskill your in-house team with Lynq & Flow's proven e-commerce CS frameworks. We deliver structured training sessions, battle-tested playbooks, and ongoing coaching to bring your team to agency-level performance.",
  features: [
    'Custom training program built for your brand',
    'Proven e-commerce CS playbooks & frameworks',
    'Live training sessions with your team',
    'Ongoing coaching & performance tracking',
  ],
  icon: Icons.graduation,
}

const GUARANTEE_ITEMS = [
  'Dedicated trainer assigned to your account',
  '2-week personal onboarding included',
  'Daily performance report sent directly to you',
]

// ── Sub-components ────────────────────────────────────────────────────────────

function CheckIcon({ size = 14, color = '#16A34A' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

function GuaranteeBlock() {
  return (
    <div style={{ background: '#FAFAFA', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 8, padding: '12px 14px', margin: '16px 0' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#BDBDBD', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>
        Our Guarantee
      </div>
      {GUARANTEE_ITEMS.map(item => (
        <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <CheckIcon size={13} />
          <span style={{ fontSize: 12, color: '#555555' }}>{item}</span>
        </div>
      ))}
    </div>
  )
}

function Badge({ badge }) {
  if (!badge) return null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 8px',
      borderRadius: badge.borderRadius ?? 100,
      fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
      color: badge.color, background: badge.bg,
      border: badge.border ? `1px solid ${badge.border}` : 'none',
    }}>
      {badge.label}
    </span>
  )
}

function IconBox({ icon }) {
  return (
    <div style={{ width: 36, height: 36, borderRadius: 8, background: '#F5F5F5', border: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {icon}
    </div>
  )
}

function ServiceCard({ svc, i, onRequest }) {
  return (
    <div className="svc-card" style={{ animation: `fadeUp .45s ease ${i * 75}ms both` }}>
      {/* Badge top-right */}
      {svc.badge && (
        <div style={{ position: 'absolute', top: 18, right: 18 }}>
          <Badge badge={svc.badge} />
        </div>
      )}

      {/* Icon */}
      <IconBox icon={svc.icon} />

      {/* Content */}
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111111', marginTop: 14, marginBottom: 8 }}>{svc.title}</h2>
      <p style={{ fontSize: 13, color: '#555555', lineHeight: 1.6, marginBottom: 16, flex: 1 }}>{svc.description}</p>

      {/* Feature list */}
      <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 0 }}>
        {svc.features.map(f => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <CheckIcon size={14} />
            <span style={{ fontSize: 13, color: '#555555' }}>{f}</span>
          </div>
        ))}
      </div>

      <GuaranteeBlock />

      <button className="req-btn" onClick={onRequest}>
        Request More Info
      </button>
    </div>
  )
}

function TrainCard({ svc, onRequest }) {
  return (
    <div className="svc-card" style={{ animation: 'fadeUp .5s ease .32s both' }}>
      {/* Badge top-right */}
      {svc.badge && (
        <div style={{ position: 'absolute', top: 18, right: 18 }}>
          <Badge badge={svc.badge} />
        </div>
      )}

      {/* Icon */}
      <IconBox icon={svc.icon} />

      {/* Content */}
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111111', marginTop: 14, marginBottom: 8 }}>{svc.title}</h2>
      <p style={{ fontSize: 13, color: '#555555', lineHeight: 1.6, marginBottom: 16, flex: 1 }}>{svc.description}</p>

      {/* Feature list */}
      <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 0 }}>
        {svc.features.map(f => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <CheckIcon size={14} />
            <span style={{ fontSize: 13, color: '#555555' }}>{f}</span>
          </div>
        ))}
      </div>

      <GuaranteeBlock />

      <button className="req-btn" onClick={onRequest}>
        Request More Info
      </button>
    </div>
  )
}

function InquiryForm({ service, phone, setPhone, message, setMessage, onSubmit, submitting, error, onClose }) {
  const isGeneral = service.id === 'general'
  return (
    <>
      <button className="close-btn" onClick={onClose} aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      <div style={{ marginBottom: 24 }}>
        {!isGeneral && service.icon ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 0 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--bg-surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {service.icon}
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
        <input
          type="tel"
          className="tel-input"
          required
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="+31 6 12345678"
          style={{ marginBottom: 18 }}
        />

        <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 7 }}>
          Your question <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
        </label>
        <textarea
          className="msg-input"
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder={isGeneral ? "What are you looking for? Any specific roles or challenges you're facing…" : "What would you like to know about this service?"}
        />

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
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.62)', lineHeight: 1.7, marginBottom: 30, maxWidth: 320, margin: '0 auto 30px' }}>
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
    <div className="sv-root" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-1)' }}>
      <style>{CSS}</style>
      <Sidebar />

      <main className="sv-scroll" style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#FAFAFA', position: 'relative' }}>

        <div style={{ maxWidth: 840, margin: '0 auto' }}>

          {/* ── Header ── */}
          <div style={{ animation: 'fadeUp .4s ease both', marginBottom: 28 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#BDBDBD', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
              Services
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111111', marginBottom: 8 }}>Grow Your Team</h1>
            <p style={{ fontSize: 14, color: '#888888', maxWidth: 480, lineHeight: 1.6 }}>
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
            <TrainCard svc={TRAIN_SERVICE} onRequest={() => openModal(TRAIN_SERVICE)} />
          </div>

          {/* ── Bottom CTA ── */}
          <div style={{ animation: 'fadeUp .5s ease .42s both', marginBottom: 40 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
              padding: '20px 24px', borderRadius: 10,
              background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)',
            }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#111111', marginBottom: 4 }}>Not sure which role you need?</p>
                <p style={{ fontSize: 13, color: '#888888' }}>We'll help you figure out the perfect fit for your brand and team size.</p>
              </div>
              <button
                onClick={() => openModal({ id: 'general', title: 'General Inquiry', icon: null })}
                style={{ padding: '0 20px', height: 38, borderRadius: 8, background: '#111111', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'background .15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#333333' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#111111' }}>
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
