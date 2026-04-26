'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

// SVG icons — zero emojis
const SUGGESTIONS = [
  {
    text: 'Top refunded products this month',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    text: 'What is my revenue this month?',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    text: 'Which orders are still unfulfilled?',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
  },
  {
    text: "What's my refund rate trend?",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
        <polyline points="16 7 22 7 22 13"/>
      </svg>
    ),
  },
]

// Ambient floating e-commerce data — ultra-low opacity
const FLOAT_ITEMS = [
  { label: 'New order', value: '€ 129.00', icon: 'order',  delay: 0,    duration: 32 },
  { label: 'Ticket closed',  value: '#4521',   icon: 'check',  delay: 8,    duration: 28 },
  { label: 'Revenue today', value: '€ 3.2k',  icon: 'chart',  delay: 14,   duration: 36 },
  { label: 'Refund approved', value: '€ 45.00', icon: 'refund', delay: 22,   duration: 30 },
  { label: 'New message',  value: 'Sarah K.', icon: 'msg',    delay: 5,    duration: 34 },
]

const FLOAT_ICON = {
  order:  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  check:  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  chart:  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/></svg>,
  refund: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>,
  msg:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
}

const CSS = `
  @keyframes auroraA {
    0%,100% { transform:translate(0,0) scale(1); opacity:.4; }
    33%      { transform:translate(80px,-100px) scale(1.2); opacity:.6; }
    66%      { transform:translate(-60px,50px) scale(.85); opacity:.3; }
  }
  @keyframes auroraB {
    0%,100% { transform:translate(0,0) scale(1); opacity:.25; }
    40%      { transform:translate(-100px,70px) scale(1.25); opacity:.45; }
    75%      { transform:translate(60px,-40px) scale(.8); opacity:.2; }
  }
  @keyframes auroraC {
    0%,100% { transform:translate(0,0) scale(1); opacity:.15; }
    55%      { transform:translate(50px,90px) scale(1.15); opacity:.3; }
  }
  @keyframes floatUp {
    0%   { transform:translateY(0) translateX(0); opacity:0; }
    8%   { opacity:1; }
    85%  { opacity:1; }
    100% { transform:translateY(-420px) translateX(20px); opacity:0; }
  }
  @keyframes revealUp {
    from { opacity:0; transform:translateY(24px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes shimmer {
    0%   { background-position:200% center; }
    100% { background-position:-200% center; }
  }
  @keyframes msgIn {
    from { opacity:0; transform:translateY(12px) scale(.97); }
    to   { opacity:1; transform:translateY(0) scale(1); }
  }
  @keyframes dotBounce {
    0%,60%,100% { transform:translateY(0); opacity:.4; }
    30%          { transform:translateY(-6px); opacity:1; }
  }
  @keyframes blink {
    0%,100% { opacity:1; }
    50%      { opacity:0; }
  }
  @keyframes spin {
    to { transform:rotate(360deg); }
  }
  @keyframes kpiCount {
    from { opacity:0; transform:translateY(8px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes borderGlow {
    0%,100% { box-shadow:0 0 0 0 rgba(48,136,255,0); }
    50%      { box-shadow:0 0 20px 2px rgba(48,136,255,0.12); }
  }
  @keyframes liveBlip {
    0%,100% { transform:scale(1); opacity:1; }
    50%      { transform:scale(1.6); opacity:.4; }
  }

  @media (prefers-reduced-motion:reduce) {
    *, *::before, *::after { animation-duration:.01ms !important; transition-duration:.01ms !important; }
  }

  .h-root { font-family:var(--font-rethink),-apple-system,BlinkMacSystemFont,sans-serif; -webkit-font-smoothing:antialiased; }
  .h-root * { box-sizing:border-box; margin:0; padding:0; }

  /* ── KPI card ── */
  .kpi-card {
    background:rgba(255,255,255,0.04);
    border:1px solid rgba(255,255,255,0.08);
    border-radius:16px;
    padding:18px 20px;
    text-align:center;
    transition:transform .25s cubic-bezier(.16,1,.3,1), border-color .25s, box-shadow .25s;
    cursor:default;
    position:relative;
    overflow:hidden;
    backdrop-filter:blur(12px);
    -webkit-backdrop-filter:blur(12px);
  }
  .kpi-card::after {
    content:'';
    position:absolute;
    top:0; left:0; right:0;
    height:1px;
    background:linear-gradient(90deg,transparent,rgba(48,136,255,0.5),transparent);
    opacity:0;
    transition:opacity .3s;
  }
  .kpi-card:hover { transform:translateY(-3px); border-color:rgba(48,136,255,0.22); box-shadow:0 12px 40px rgba(48,136,255,0.1); }
  .kpi-card:hover::after { opacity:1; }

  /* ── Suggestion chips ── */
  .chip {
    display:flex; align-items:center; gap:9px;
    padding:11px 18px;
    background:rgba(255,255,255,0.04);
    border:1px solid rgba(255,255,255,0.08);
    border-radius:14px;
    color:rgba(248,250,252,0.55);
    font-size:13px; font-family:inherit;
    cursor:pointer; transition:all .25s cubic-bezier(.16,1,.3,1);
    text-align:left; white-space:nowrap; backdrop-filter:blur(8px);
  }
  .chip:hover {
    background:rgba(48,136,255,0.1);
    border-color:rgba(48,136,255,0.3);
    color:#F8FAFC;
    transform:translateY(-2px);
    box-shadow:0 6px 24px rgba(48,136,255,0.12);
  }
  .chip svg { flex-shrink:0; }

  /* ── Chat input ── */
  .chat-box {
    background:rgba(255,255,255,0.04);
    border:1px solid rgba(255,255,255,0.1);
    border-radius:20px;
    transition:all .3s cubic-bezier(.16,1,.3,1);
    backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
  }
  .chat-box:focus-within {
    border-color:rgba(48,136,255,0.45);
    background:rgba(48,136,255,0.04);
    box-shadow:0 0 0 4px rgba(48,136,255,0.08), 0 16px 48px rgba(48,136,255,0.08);
  }
  .chat-box textarea {
    background:transparent; border:none; outline:none;
    color:#F8FAFC; font-size:15px; line-height:1.6; resize:none;
    font-family:inherit; width:100%; padding:0; max-height:180px; overflow-y:auto;
  }
  .chat-box textarea::placeholder { color:rgba(248,250,252,0.22); }

  /* ── Send button ── */
  .send-btn {
    width:40px; height:40px; border-radius:12px;
    background:linear-gradient(135deg,#3088FF 0%,#1A6AE0 100%);
    border:none; display:flex; align-items:center; justify-content:center;
    cursor:pointer; flex-shrink:0;
    transition:all .2s cubic-bezier(.16,1,.3,1);
    box-shadow:0 4px 16px rgba(48,136,255,0.35);
  }
  .send-btn:hover:not(:disabled) {
    transform:translateY(-1px) scale(1.06);
    box-shadow:0 8px 28px rgba(48,136,255,0.45);
    background:linear-gradient(135deg,#5AA3FF 0%,#3088FF 100%);
  }
  .send-btn:active:not(:disabled) { transform:scale(.96); }
  .send-btn:disabled { opacity:.3; cursor:not-allowed; box-shadow:none; }

  /* ── Chat bubbles ── */
  .msg-user {
    background:linear-gradient(135deg,rgba(48,136,255,0.18),rgba(48,136,255,0.1));
    border:1px solid rgba(48,136,255,0.22);
    border-radius:20px 20px 5px 20px;
    backdrop-filter:blur(12px);
  }
  .msg-ai {
    background:rgba(255,255,255,0.05);
    border:1px solid rgba(255,255,255,0.09);
    border-radius:20px 20px 20px 5px;
    backdrop-filter:blur(12px);
  }

  /* ── Float cards ── */
  .float-card {
    position:absolute;
    display:flex; align-items:center; gap:8px;
    padding:8px 12px;
    background:rgba(255,255,255,0.04);
    border:1px solid rgba(255,255,255,0.07);
    border-radius:10px;
    backdrop-filter:blur(8px);
    white-space:nowrap;
    pointer-events:none;
    opacity:0;
  }

  /* ── Scrollbar ── */
  .chat-scroll::-webkit-scrollbar { width:3px; }
  .chat-scroll::-webkit-scrollbar-track { background:transparent; }
  .chat-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:2px; }
`

function useCountUp(target, duration = 1200, decimals = 0) {
  const [val, setVal] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (target === 0 || started.current) return
    started.current = true
    const start = performance.now()
    const num = parseFloat(String(target).replace(/[^0-9.]/g, ''))

    function tick(now) {
      const p = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 4)
      setVal(+(num * ease).toFixed(decimals))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration, decimals])

  return val
}

function KpiCard({ label, raw, prefix = '', suffix = '', delay = 0 }) {
  const num = parseFloat(String(raw || 0).replace(/[^0-9.]/g, ''))
  const decimals = String(raw).includes('.') ? 1 : 0
  const counted = useCountUp(num, 1400, decimals)
  const display = prefix + (isNaN(counted) ? '—' : counted.toLocaleString('nl-NL', { minimumFractionDigits: decimals })) + suffix

  return (
    <div className="kpi-card" style={{ animation: `revealUp .6s cubic-bezier(.16,1,.3,1) ${delay}ms both` }}>
      <div style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.025em', color: '#F8FAFC', marginBottom: '5px', animation: `kpiCount .5s ease ${delay + 200}ms both` }}>
        {display}
      </div>
      <div style={{ fontSize: '11px', color: 'rgba(248,250,252,0.35)', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 500 }}>
        {label}
      </div>
    </div>
  )
}

function FloatCard({ label, value, icon, delay, duration }) {
  const positions = [
    { left: '12%', bottom: '5%' },
    { left: '32%', bottom: '8%' },
    { left: '55%', bottom: '3%' },
    { left: '72%', bottom: '10%' },
    { left: '88%', bottom: '6%' },
  ]
  const pos = positions[FLOAT_ITEMS.findIndex(i => i.label === label) % positions.length]

  return (
    <div
      className="float-card"
      style={{
        ...pos,
        animation: `floatUp ${duration}s ease-in-out ${delay}s infinite`,
        zIndex: 0,
      }}
    >
      <span style={{ color: 'rgba(48,136,255,0.7)', display: 'flex' }}>{FLOAT_ICON[icon]}</span>
      <span style={{ fontSize: '11px', color: 'rgba(248,250,252,0.3)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: '11px', color: 'rgba(248,250,252,0.5)', fontWeight: 600 }}>{value}</span>
    </div>
  )
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: '5px', alignItems: 'center', padding: '4px 0' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: 'rgba(48,136,255,0.65)',
          animation: `dotBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  )
}

function LynqBadge() {
  return (
    <div style={{
      width: 30, height: 30, borderRadius: '9px',
      background: 'linear-gradient(135deg,#3088FF 0%,#FF6B35 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      boxShadow: '0 4px 14px rgba(48,136,255,0.3)',
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
    </div>
  )
}

function ChatMessage({ role, content, isStreaming }) {
  const isUser = role === 'user'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: '14px', animation: 'msgIn .35s cubic-bezier(.16,1,.3,1) both' }}>
      {!isUser && <div style={{ marginRight: '10px', marginTop: '3px', flexShrink: 0 }}><LynqBadge /></div>}
      <div className={isUser ? 'msg-user' : 'msg-ai'} style={{ maxWidth: '74%', padding: '13px 17px', fontSize: '14px', lineHeight: '1.72', color: isUser ? 'rgba(248,250,252,0.95)' : 'rgba(248,250,252,0.85)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {isStreaming && !content ? <TypingDots /> : content}
        {isStreaming && content && (
          <span style={{ display: 'inline-block', width: '2px', height: '14px', background: '#3088FF', marginLeft: '2px', verticalAlign: 'text-bottom', animation: 'blink 1s ease-in-out infinite' }} />
        )}
      </div>
    </div>
  )
}

export default function HomePage() {
  const [session, setSession]           = useState(null)
  const [userName, setUserName]         = useState('')
  const [messages, setMessages]         = useState([])
  const [input, setInput]               = useState('')
  const [isLoading, setIsLoading]       = useState(false)
  const [storeContext, setStoreContext]  = useState(null)
  const [contextLoaded, setContextLoaded] = useState(false)
  const [mounted, setMounted]           = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef       = useRef(null)
  const greeting       = getGreeting()

  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return }
      setSession(session)
      const email = session.user.email || ''
      const raw   = email.split('@')[0]
      setUserName(raw.charAt(0).toUpperCase() + raw.slice(1))
      loadContext(session.access_token)
    })
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadContext(token) {
    const h = { Authorization: `Bearer ${token}` }
    try {
      const [a, b, c] = await Promise.all([
        fetch('/api/shopify/kpis',    { headers: h }),
        fetch('/api/shopify/orders',  { headers: h }),
        fetch('/api/shopify/refunds', { headers: h }),
      ])
      const kpis              = a.ok ? await a.json() : {}
      const { orders  = [] }  = b.ok ? await b.json() : {}
      const { refunds = [] }  = c.ok ? await c.json() : {}
      setStoreContext({ kpis, orders, refunds })
    } catch { setStoreContext({}) }
    finally  { setContextLoaded(true) }
  }

  const sendMessage = useCallback(async (text) => {
    const t = text.trim()
    if (!t || isLoading || !session) return
    setInput('')
    setIsLoading(true)
    setMessages(prev => [...prev, { role: 'user', content: t }, { role: 'assistant', content: '', isStreaming: true }])

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ message: t, context: storeContext }),
      })
      if (!res.ok || !res.body) throw new Error()

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        const snap = acc
        setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: snap, isStreaming: true }; return u })
      }
      setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: acc, isStreaming: false }; return u })
    } catch {
      setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: 'Something went wrong. Please try again.', isStreaming: false }; return u })
    } finally {
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [isLoading, session, storeContext])

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  const kpis       = storeContext?.kpis || {}
  const hasMsg     = messages.length > 0
  const showKpis   = contextLoaded && (kpis.totalOrders > 0 || kpis.netRevenue > 0)

  if (!mounted) return null

  return (
    <div className="h-root" style={{ display: 'flex', minHeight: '100vh', background: '#06091A' }}>
      <style>{CSS}</style>
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', minWidth: 0 }}>

        {/* ── Aurora background ── */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
          <div style={{ position: 'absolute', top: '-15%', left: '25%', width: '700px', height: '600px', borderRadius: '50%', background: 'radial-gradient(ellipse,rgba(48,136,255,0.13) 0%,transparent 70%)', animation: 'auroraA 20s ease-in-out infinite', filter: 'blur(60px)' }} />
          <div style={{ position: 'absolute', bottom: '-5%', right: '5%',  width: '550px', height: '550px', borderRadius: '50%', background: 'radial-gradient(ellipse,rgba(255,107,53,0.08) 0%,transparent 70%)',  animation: 'auroraB 26s ease-in-out infinite', filter: 'blur(60px)' }} />
          <div style={{ position: 'absolute', top: '40%',  left: '-8%',   width: '450px', height: '450px', borderRadius: '50%', background: 'radial-gradient(ellipse,rgba(139,92,246,0.07) 0%,transparent 70%)', animation: 'auroraC 30s ease-in-out infinite', filter: 'blur(60px)' }} />
          {/* Subtle grid */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.018) 1px,transparent 1px)', backgroundSize: '72px 72px', maskImage: 'radial-gradient(ellipse 80% 80% at 50% 30%,black 40%,transparent 100%)' }} />
          {/* Floating e-commerce ambient cards */}
          {FLOAT_ITEMS.map(item => <FloatCard key={item.label} {...item} />)}
        </div>

        {/* ── Scroll area ── */}
        <div className="chat-scroll" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 32px', position: 'relative', zIndex: 1 }}>

          {/* ── HERO ── */}
          {!hasMsg && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', maxWidth: '700px', width: '100%', padding: '56px 0 28px' }}>

              {/* Live greeting pill */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '6px 18px', borderRadius: '100px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', marginBottom: '28px', animation: 'revealUp .6s cubic-bezier(.16,1,.3,1) both', backdropFilter: 'blur(8px)' }}>
                <div style={{ position: 'relative', width: 8, height: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80' }} />
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#4ade80', animation: 'liveBlip 2s ease-in-out infinite' }} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(248,250,252,0.4)' }}>
                  {greeting}
                </span>
              </div>

              {/* Main heading */}
              <h1 style={{ fontSize: 'clamp(34px,5.5vw,58px)', fontWeight: 800, letterSpacing: '-0.032em', lineHeight: 1.08, color: '#F8FAFC', marginBottom: '18px', animation: 'revealUp .65s cubic-bezier(.16,1,.3,1) .08s both' }}>
                Welcome back,{' '}
                <span style={{
                  background: 'linear-gradient(120deg,#93C5FD 0%,#3088FF 30%,#60A5FA 50%,#FF6B35 75%,#FB923C 100%)',
                  backgroundSize: '250% auto',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  animation: 'shimmer 5s linear infinite',
                }}>
                  {userName || 'there'}
                </span>
              </h1>

              <p style={{ fontSize: '16px', color: 'rgba(248,250,252,0.36)', lineHeight: 1.75, maxWidth: '420px', marginBottom: '48px', fontWeight: 400, animation: 'revealUp .65s cubic-bezier(.16,1,.3,1) .15s both' }}>
                {contextLoaded
                  ? 'Ask anything about your store — revenue, refunds, orders, trends.'
                  : 'Connecting to your store…'}
              </p>

              {/* KPI cards */}
              {showKpis && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', width: '100%', marginBottom: '44px' }}>
                  <KpiCard label="Orders"      raw={kpis.totalOrders}  delay={220} />
                  <KpiCard label="Revenue"     raw={kpis.netRevenue}   prefix="€"  delay={300} />
                  <KpiCard label="Refund rate" raw={kpis.refundRate}   suffix="%"  delay={380} />
                  <KpiCard label="Refunds"     raw={kpis.totalRefunds} delay={460} />
                </div>
              )}

              {/* Skeleton while loading */}
              {!contextLoaded && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', width: '100%', marginBottom: '44px' }}>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} style={{ height: 80, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', animation: `revealUp .5s ease ${i * 80}ms both` }} />
                  ))}
                </div>
              )}

              {/* Suggestion chips */}
              {contextLoaded && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', maxWidth: '620px', animation: 'revealUp .65s cubic-bezier(.16,1,.3,1) .34s both' }}>
                  {SUGGESTIONS.map(({ text, icon }) => (
                    <button key={text} className="chip" onClick={() => sendMessage(text)} disabled={isLoading}>
                      <span style={{ color: 'rgba(48,136,255,0.7)', display: 'flex', flexShrink: 0 }}>{icon}</span>
                      {text}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── MESSAGES ── */}
          {hasMsg && (
            <div style={{ width: '100%', maxWidth: '760px', paddingTop: '40px', paddingBottom: '16px' }}>
              {messages.map((msg, i) => <ChatMessage key={i} {...msg} />)}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ── INPUT ── */}
        <div style={{ padding: '16px 32px 32px', display: 'flex', justifyContent: 'center', background: 'linear-gradient(to top,#06091A 60%,transparent)', position: 'relative', zIndex: 2 }}>
          <div style={{ width: '100%', maxWidth: '760px' }}>
            <div className="chat-box" style={{ padding: '15px 15px 15px 20px', display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder={contextLoaded ? 'Ask anything about your store…' : 'Connecting to your store…'}
                disabled={!contextLoaded || isLoading}
                rows={1}
                onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px' }}
              />
              <button className="send-btn" onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading || !contextLoaded} aria-label="Send message">
                {isLoading
                  ? <div style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.25)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                }
              </button>
            </div>
            <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '11px', color: 'rgba(248,250,252,0.16)', letterSpacing: '.03em' }}>
              Lynq AI · Answers based on live store data · ↵ Enter to send
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
