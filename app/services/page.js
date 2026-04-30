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
  .sv-root    { font-family:var(--font-rethink),-apple-system,BlinkMacSystemFont,sans-serif;-webkit-font-smoothing:antialiased }
  .sv-scroll::-webkit-scrollbar       { width:3px }
  .sv-scroll::-webkit-scrollbar-track { background:transparent }
  .sv-scroll::-webkit-scrollbar-thumb { background:var(--scrollbar);border-radius:2px }

  .svc-card {
    background:var(--bg-surface);
    border:1px solid var(--border);
    border-radius:20px;padding:30px;
    display:flex;flex-direction:column;
    position:relative;overflow:hidden;
    cursor:pointer;
    box-shadow:var(--shadow-card);
    transition:transform .28s cubic-bezier(.16,1,.3,1),border-color .22s,box-shadow .28s cubic-bezier(.16,1,.3,1);
  }
  .svc-card:hover {
    transform:translateY(-5px);
    border-color:var(--border-hover);
    box-shadow:var(--shadow-card-hover);
  }

  .svc-icon {
    width:54px;height:54px;border-radius:14px;
    display:flex;align-items:center;justify-content:center;
    flex-shrink:0;margin-bottom:22px;
    transition:transform .22s,box-shadow .22s;
  }
  .svc-card:hover .svc-icon { transform:scale(1.08) }

  .req-btn {
    width:100%;padding:11px 20px;border-radius:10px;
    font-size:13px;font-weight:700;cursor:pointer;
    font-family:inherit;letter-spacing:.015em;
    transition:all .15s;
    background:#111111;color:#fff;border:none;
  }
  .req-btn:hover { background:#333333;transform:translateY(-1px) }

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
    transition:all .15s;
  }
  .send-btn:hover:not(:disabled) { background:#333333;transform:translateY(-1px) }
  .send-btn:disabled { opacity:.55;cursor:not-allowed }
`

// ── Service data ──────────────────────────────────────────────────────────────

const SERVICES = [
  {
    id: 'customer_service_agent',
    title: 'Customer Service Agent',
    badge: { label: 'Most Popular', color: '#fff', bg: '#111111', border: 'rgba(0,0,0,0.1)' },
    description: 'A trained specialist who handles all incoming customer inquiries — tracking, refunds, returns, and general support. Fully onboarded to your brand voice and policies.',
    accent: '#555555',
    iconBg: 'var(--bg-surface-2)',
    iconBorder: 'var(--border)',
    cardBorderHover: 'rgba(0,0,0,0.12)',
    features: ['100+ tickets handled daily', 'Trained on your brand voice & policies', 'Gorgias, Zendesk & Re:amaze certified'],
    icon: (c) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
        <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
      </svg>
    ),
  },
  {
    id: 'dispute_manager',
    title: 'Dispute Manager',
    description: 'An expert in handling chargebacks, payment disputes, and escalated cases. Protects your revenue and keeps your chargeback rate under control.',
    accent: '#4ade80',
    iconBg: 'rgba(74,222,128,0.08)',
    iconBorder: 'rgba(74,222,128,0.2)',
    cardBorderHover: 'rgba(74,222,128,0.2)',
    features: ['Chargeback & dispute resolution', 'Revenue protection strategy', 'Stripe, PayPal & Klarna specialist'],
    icon: (c) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
  {
    id: 'supply_chain_manager',
    title: 'Supply Chain Manager',
    description: 'Oversees supplier relationships, order fulfillment, stock management, and shipping performance. Keeps your operations running without bottlenecks.',
    accent: '#60a5fa',
    iconBg: 'rgba(96,165,250,0.08)',
    iconBorder: 'rgba(96,165,250,0.2)',
    cardBorderHover: 'rgba(96,165,250,0.2)',
    features: ['Supplier & vendor management', 'Inventory & stock optimization', 'Fulfillment & shipping oversight'],
    icon: (c) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13"/>
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
        <circle cx="5.5" cy="18.5" r="2.5"/>
        <circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
    ),
  },
  {
    id: 'senior_backend_manager',
    title: 'Senior Backend Manager',
    description: 'Manages your entire CS operation end-to-end. Sets up systems, leads the team, handles escalations, and reports directly to you.',
    accent: '#f59e0b',
    iconBg: 'rgba(245,158,11,0.08)',
    iconBorder: 'rgba(245,158,11,0.2)',
    cardBorderHover: 'rgba(245,158,11,0.2)',
    features: ['Full CS operation ownership', 'Team setup, lead & escalation mgmt', 'Weekly direct-to-you reporting'],
    icon: (c) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
        <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
        <line x1="1" y1="14" x2="7" y2="14"/>
        <line x1="9" y1="8" x2="15" y2="8"/>
        <line x1="17" y1="16" x2="23" y2="16"/>
      </svg>
    ),
  },
]

const TRAIN_SERVICE = {
  id: 'train_existing_team',
  title: 'Train Your Existing Team',
  badge: { label: 'New', color: '#4ade80', bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.28)' },
  description: "Upskill your in-house team with Lynq & Flow's proven e-commerce CS frameworks. We deliver structured training sessions, battle-tested playbooks, and ongoing coaching to bring your team to agency-level performance.",
  accent: '#f97316',
  iconBg: 'rgba(249,115,22,0.08)',
  iconBorder: 'rgba(249,115,22,0.2)',
  cardBorderHover: 'rgba(249,115,22,0.2)',
  features: [
    'Custom training program built for your brand',
    'Proven e-commerce CS playbooks & frameworks',
    'Live training sessions with your team',
    'Ongoing coaching & performance tracking',
  ],
  icon: (c) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
      <path d="M6 12v5c3 3 9 3 12 0v-5"/>
    </svg>
  ),
}

const GUARANTEE_ITEMS = [
  'Dedicated trainer assigned to your account',
  '2-week personal onboarding included',
  'Daily performance report sent directly to you',
]

// ── Sub-components ────────────────────────────────────────────────────────────

function GuaranteeBlock() {
  return (
    <div style={{ margin:'16px 0 20px', padding:'16px 18px', borderRadius:12, background:'linear-gradient(135deg,rgba(74,222,128,0.08) 0%,rgba(74,222,128,0.03) 100%)', border:'1px solid rgba(74,222,128,0.22)', boxShadow:'0 0 24px rgba(74,222,128,0.06),inset 0 1px 0 rgba(74,222,128,0.08)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="#4ade80" style={{ flexShrink:0 }}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        <div style={{ fontSize:10, fontWeight:800, color:'#4ade80', textTransform:'uppercase', letterSpacing:'.08em' }}>Our Guarantee</div>
      </div>
      {GUARANTEE_ITEMS.map(item => (
        <div key={item} style={{ display:'flex', alignItems:'flex-start', gap:9, marginBottom:8 }}>
          <div style={{ width:16, height:16, borderRadius:'50%', background:'rgba(74,222,128,0.15)', border:'1px solid rgba(74,222,128,0.3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <span style={{ fontSize:12.5, color:'rgba(255,255,255,0.82)', lineHeight:1.45 }}>{item}</span>
        </div>
      ))}
    </div>
  )
}

function Badge({ badge }) {
  if (!badge) return null
  return (
    <span style={{ display:'inline-flex', alignItems:'center', padding:'3px 9px', borderRadius:100, fontSize:10, fontWeight:800, letterSpacing:'.06em', textTransform:'uppercase', color:badge.color, background:badge.bg, border:`1px solid ${badge.border}` }}>
      {badge.label}
    </span>
  )
}

function FeatureDot({ color }) {
  return <div style={{ width:5, height:5, borderRadius:'50%', background:color, opacity:.65, flexShrink:0, marginTop:6 }} />
}

function ServiceCard({ svc, i, onRequest }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      className="svc-card"
      style={{
        animation:`fadeUp .45s ease ${i * 75}ms both`,
        borderColor: hovered ? svc.cardBorderHover : 'var(--bg-surface-2)',
        boxShadow: hovered
          ? `0 20px 56px rgba(0,0,0,0.45), 0 0 0 1px ${svc.accent}22, 0 0 40px ${svc.accent}12`
          : '0 4px 20px rgba(0,0,0,0.35)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Top accent stripe */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${svc.accent},${svc.accent}44,transparent)`, borderRadius:'20px 20px 0 0' }} />

      {/* Badge top-right */}
      {svc.badge && (
        <div style={{ position:'absolute', top:22, right:22 }}>
          <Badge badge={svc.badge} />
        </div>
      )}

      {/* Icon */}
      <div className="svc-icon" style={{ background:`linear-gradient(145deg,${svc.accent}22,${svc.accent}0a)`, border:`1px solid ${svc.iconBorder}`, boxShadow: hovered ? `0 0 20px ${svc.accent}30` : 'none' }}>
        {svc.icon(svc.accent)}
      </div>

      {/* Content */}
      <h2 style={{ fontSize:18, fontWeight:800, color:'var(--text-1)', letterSpacing:'-0.035em', lineHeight:1.2, marginBottom:10 }}>{svc.title}</h2>
      <p style={{ fontSize:13.5, color:'var(--text-2)', lineHeight:1.7, marginBottom:20, flex:1 }}>{svc.description}</p>

      {/* Feature bullets */}
      <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom:4 }}>
        {svc.features.map(f => (
          <div key={f} style={{ display:'flex', alignItems:'flex-start', gap:9 }}>
            <div style={{ width:15, height:15, borderRadius:'50%', background:`${svc.accent}18`, border:`1px solid ${svc.accent}44`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:2 }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={svc.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <span style={{ fontSize:12.5, color:'var(--text-2)', lineHeight:1.45 }}>{f}</span>
          </div>
        ))}
      </div>

      {/* Guarantee */}
      <GuaranteeBlock />

      {/* CTA */}
      <button className="req-btn" onClick={onRequest}>
        Request More Info
      </button>
    </div>
  )
}

function TrainCard({ svc, onRequest }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      className="svc-card"
      style={{
        borderColor: hovered ? svc.cardBorderHover : 'var(--bg-surface-2)',
        boxShadow: hovered
          ? `0 20px 56px rgba(0,0,0,0.45), 0 0 0 1px ${svc.accent}22, 0 0 40px ${svc.accent}12`
          : '0 4px 20px rgba(0,0,0,0.35)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Top accent stripe */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${svc.accent},${svc.accent}44,transparent)`, borderRadius:'20px 20px 0 0' }} />

      <div style={{ display:'flex', gap:32, alignItems:'flex-start', flexWrap:'wrap' }}>
        {/* Left */}
        <div style={{ flex:'1 1 300px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
            <div className="svc-icon" style={{ background:`linear-gradient(145deg,${svc.accent}22,${svc.accent}0a)`, border:`1px solid ${svc.iconBorder}`, marginBottom:0, boxShadow: hovered ? `0 0 20px ${svc.accent}30` : 'none' }}>
              {svc.icon(svc.accent)}
            </div>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                <h2 style={{ fontSize:18.5, fontWeight:800, color:'var(--text-1)', letterSpacing:'-0.03em' }}>{svc.title}</h2>
                <Badge badge={svc.badge} />
              </div>
              <p style={{ fontSize:12, color:'rgba(255,255,255,0.52)', fontWeight:500 }}>For brands with an in-house team</p>
            </div>
          </div>
          <p style={{ fontSize:13.5, color:'var(--text-2)', lineHeight:1.7 }}>{svc.description}</p>
        </div>

        {/* Right */}
        <div style={{ flex:'0 1 260px', display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {svc.features.map(f => (
              <div key={f} style={{ display:'flex', alignItems:'flex-start', gap:9 }}>
                <div style={{ width:15, height:15, borderRadius:'50%', background:`${svc.accent}18`, border:`1px solid ${svc.accent}44`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:2 }}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={svc.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <span style={{ fontSize:12.5, color:'var(--text-2)', lineHeight:1.45 }}>{f}</span>
              </div>
            ))}
          </div>
          <GuaranteeBlock />
          <button
            className="req-btn"
            onClick={onRequest}
          >
            Request More Info
          </button>
        </div>
      </div>
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

      {/* Header */}
      <div style={{ marginBottom:24 }}>
        {!isGeneral && service.icon ? (
          <div style={{ display:'flex', alignItems:'center', gap:13, marginBottom:0 }}>
            <div style={{ width:44, height:44, borderRadius:12, background:service.iconBg || `${service.accent}14`, border:`1px solid ${service.iconBorder || service.accent + '30'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              {service.icon(service.accent)}
            </div>
            <div>
              <div style={{ fontSize:10.5, fontWeight:700, color:service.accent, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:3 }}>Service Inquiry</div>
              <h3 style={{ fontSize:18, fontWeight:800, color:'var(--text-1)', letterSpacing:'-0.03em', lineHeight:1.2 }}>{service.title}</h3>
            </div>
          </div>
        ) : (
          <div>
            <h3 style={{ fontSize:22, fontWeight:800, color:'var(--text-1)', letterSpacing:'-0.04em', marginBottom:6 }}>Let's talk</h3>
            <p style={{ fontSize:13.5, color:'var(--text-2)' }}>Tell us what you're looking for and we'll find the right fit.</p>
          </div>
        )}
      </div>

      {/* Reply time */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:9, background:'var(--bg-surface-2)', border:'1px solid var(--border)', marginBottom:24 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span style={{ fontSize:12.5, color:'var(--text-2)' }}>We reply within <strong style={{ color:'var(--text-2)' }}>24 hours</strong></span>
      </div>

      <form onSubmit={onSubmit}>
        {/* Phone number */}
        <label style={{ display:'block', fontSize:10.5, fontWeight:700, color:'var(--text-2)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:7 }}>
          WhatsApp number <span style={{ color:'#f87171', fontWeight:800 }}>*</span>
        </label>
        <input
          type="tel"
          className="tel-input"
          required
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="+31 6 12345678"
          style={{ marginBottom:18 }}
        />

        <label style={{ display:'block', fontSize:10.5, fontWeight:700, color:'var(--text-2)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:7 }}>
          Your question <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0 }}>(optional)</span>
        </label>
        <textarea
          className="msg-input"
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder={isGeneral ? "What are you looking for? Any specific roles or challenges you're facing…" : "What would you like to know about this service?"}
        />

        {error && (
          <div style={{ fontSize:12.5, color:'#f87171', marginTop:8, display:'flex', alignItems:'center', gap:6 }}>
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
    <div style={{ textAlign:'center', padding:'12px 0 8px' }}>
      <div style={{ width:68, height:68, borderRadius:'50%', background:'rgba(74,222,128,0.1)', border:'1.5px solid rgba(74,222,128,0.3)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 22px', animation:'checkPop .45s cubic-bezier(.16,1,.3,1) both' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h3 style={{ fontSize:22, fontWeight:800, color:'var(--text-1)', letterSpacing:'-0.04em', marginBottom:8 }}>Request sent!</h3>
      {serviceName && serviceName !== 'General Inquiry' && (
        <div style={{ display:'inline-flex', alignItems:'center', padding:'4px 12px', borderRadius:100, background:'var(--bg-surface-2)', border:'1px solid var(--border)', fontSize:12, color:'var(--text-2)', marginBottom:14 }}>
          {serviceName}
        </div>
      )}
      <p style={{ fontSize:14, color:'rgba(255,255,255,0.62)', lineHeight:1.7, marginBottom:30, maxWidth:320, margin:'0 auto 30px' }}>
        Your inquiry is with the Lynq & Flow team. We'll reach out within <strong style={{ color:'var(--text-2)' }}>24 hours</strong>.
      </p>
      <button onClick={onClose} style={{ padding:'11px 30px', borderRadius:10, border:'1px solid var(--border)', background:'var(--bg-surface-2)', color:'var(--text-2)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all .15s' }}
        onMouseEnter={e => e.currentTarget.style.background='var(--bg-input)'}
        onMouseLeave={e => e.currentTarget.style.background='var(--bg-input)'}>
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
    <div className="sv-root" style={{ display:'flex', minHeight:'100vh', background:'var(--bg-page)', color:'var(--text-1)' }}>
      <style>{CSS}</style>
      <Sidebar />

      <main className="sv-scroll" style={{ flex:1, overflowY:'auto', padding:'40px 44px', position:'relative' }}>

        <div style={{ position:'relative', zIndex:1, maxWidth:840, margin:'0 auto' }}>

          {/* ── Header ── */}
          <div style={{ animation:'fadeUp .4s ease both', marginBottom:40 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:'var(--bg-surface-2)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <span style={{ fontSize:11.5, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.08em' }}>Services</span>
            </div>
            <h1 style={{ fontSize:36, fontWeight:800, letterSpacing:'-0.045em', lineHeight:1.1, marginBottom:12, color:'var(--text-1)' }}>Grow Your Team</h1>
            <p style={{ fontSize:14.5, color:'var(--text-2)', lineHeight:1.65, maxWidth:500 }}>
              World-class e-commerce specialists, trained to your brand standards and ready to perform from day one.
            </p>
            <div style={{ height:1, background:'var(--bg-surface-2)', marginTop:28 }} />
          </div>

          {/* ── 2 × 2 grid ── */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
            {SERVICES.map((svc, i) => (
              <ServiceCard key={svc.id} svc={svc} i={i} onRequest={() => openModal(svc)} />
            ))}
          </div>

          {/* ── Train Your Team — full-width ── */}
          <div style={{ animation:'fadeUp .5s ease .32s both', marginBottom:28 }}>
            <TrainCard svc={TRAIN_SERVICE} onRequest={() => openModal(TRAIN_SERVICE)} />
          </div>

          {/* ── Bottom CTA ── */}
          <div style={{ animation:'fadeUp .5s ease .42s both', marginBottom:48 }}>
            <div style={{
              display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16,
              padding:'24px 30px', borderRadius:16,
              background:'var(--bg-surface)',
              border:'1px solid var(--border)',
            }}>
              <div>
                <p style={{ fontSize:15.5, fontWeight:700, color:'var(--text-1)', marginBottom:4 }}>Not sure which role you need?</p>
                <p style={{ fontSize:13.5, color:'var(--text-2)' }}>We'll help you figure out the perfect fit for your brand and team size.</p>
              </div>
              <button
                onClick={() => openModal({ id:'general', title:'General Inquiry', accent:'#555555', icon:null, iconBg:'var(--bg-surface-2)', iconBorder:'var(--border)' })}
                style={{ padding:'13px 28px', borderRadius:11, background:'#111111', color:'#fff', border:'none', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', letterSpacing:'.01em', transition:'all .15s', whiteSpace:'nowrap' }}
                onMouseEnter={e => { e.currentTarget.style.background='#333333'; e.currentTarget.style.transform='translateY(-1px)' }}
                onMouseLeave={e => { e.currentTarget.style.background='#111111'; e.currentTarget.style.transform='translateY(0)' }}>
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
