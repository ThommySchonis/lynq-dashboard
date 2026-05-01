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

const SUGGESTIONS = [
  {
    text: 'Top refunded products this month',
    color: '#fb7185',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
      </svg>
    ),
  },
  {
    text: 'What is my revenue this month?',
    color: '#4ade80',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    text: 'Which orders are still unfulfilled?',
    color: '#FB923C',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
  },
  {
    text: "What's my refund rate trend?",
    color: 'var(--accent)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
        <polyline points="16 7 22 7 22 13"/>
      </svg>
    ),
  },
]

const FLOAT_ITEMS = [
  { label: 'New order',       value: '€129.00',  icon: 'order',  delay: 0,  duration: 34, left: '7%'  },
  { label: 'Ticket closed',   value: '#4521',    icon: 'check',  delay: 9,  duration: 29, left: '26%' },
  { label: 'Revenue today',   value: '€3.2k',    icon: 'chart',  delay: 17, duration: 38, left: '51%' },
  { label: 'Refund approved', value: '€45.00',   icon: 'refund', delay: 25, duration: 31, left: '72%' },
  { label: 'New message',     value: 'Sarah K.', icon: 'msg',    delay: 6,  duration: 36, left: '87%' },
]

const FLOAT_ICON = {
  order:  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  check:  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  chart:  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/></svg>,
  refund: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>,
  msg:    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
}


const CSS = `
  @keyframes auroraA {
    0%,100% { transform:translate(0,0) scale(1);           opacity:.9; }
    33%      { transform:translate(90px,-110px) scale(1.3); opacity:1; }
    66%      { transform:translate(-65px,55px) scale(.85);  opacity:.7; }
  }
  @keyframes auroraB {
    0%,100% { transform:translate(0,0) scale(1);            opacity:.85; }
    40%      { transform:translate(-110px,75px) scale(1.28); opacity:1; }
    75%      { transform:translate(65px,-45px) scale(.78);   opacity:.6; }
  }
  @keyframes auroraC {
    0%,100% { transform:translate(0,0) scale(1);          opacity:.75; }
    55%      { transform:translate(55px,95px) scale(1.18); opacity:1; }
  }
  @keyframes auroraD {
    0%,100% { transform:translate(0,0) scale(1);            opacity:.8; }
    45%      { transform:translate(-65px,-60px) scale(1.35); opacity:1; }
  }
  @keyframes auroraE {
    0%,100% { transform:translate(0,0) scale(1);          opacity:.65; }
    60%      { transform:translate(85px,40px) scale(1.18); opacity:1; }
  }
  @keyframes floatUp {
    0%   { transform:translateY(0) translateX(0);    opacity:0; }
    8%   { opacity:1; }
    88%  { opacity:1; }
    100% { transform:translateY(-500px) translateX(10px); opacity:0; }
  }
  @keyframes revealUp {
    from { opacity:0; transform:translateY(20px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes shimmer {
    0%   { background-position:200% center; }
    25%  { background-position:-200% center; }
    100% { background-position:-200% center; }
  }
  @keyframes msgIn {
    from { opacity:0; transform:translateY(10px) scale(.98); }
    to   { opacity:1; transform:translateY(0) scale(1); }
  }
  @keyframes dotBounce {
    0%,60%,100% { transform:translateY(0); opacity:.35; }
    30%          { transform:translateY(-5px); opacity:1; }
  }
  @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }
  @keyframes spin { to { transform:rotate(360deg); } }
  @keyframes liveBlip {
    0%,100% { transform:scale(1); opacity:.85; }
    50%      { transform:scale(2); opacity:0; }
  }
  @keyframes chipReveal {
    from { opacity:0; transform:translateY(8px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes inputReveal {
    from { opacity:0; transform:translateY(16px) scale(.98); }
    to   { opacity:1; transform:translateY(0) scale(1); }
  }
  @keyframes pulseGlow {
    0%,100% { box-shadow:none; }
    50%      { box-shadow:none; }
  }

  @media (prefers-reduced-motion:reduce) {
    *, *::before, *::after { animation-duration:.01ms !important; transition-duration:.01ms !important; }
  }

  .h-root { font-family:'Switzer',-apple-system,BlinkMacSystemFont,sans-serif; -webkit-font-smoothing:antialiased; }
  .h-root * { box-sizing:border-box; margin:0; padding:0; }

  /* ── Chip ── */
  .chip {
    display:inline-flex; align-items:center; gap:9px;
    padding:9px 15px;
    background:rgba(255,255,255,0.85);
    border:1px solid rgba(0,0,0,0.08);
    border-radius:13px;
    color:var(--text-2);
    font-size:12.5px; font-family:inherit;
    cursor:pointer;
    transition:all .24s cubic-bezier(.16,1,.3,1);
    white-space:nowrap;
    box-shadow:0 1px 4px rgba(0,0,0,0.06);
    backdrop-filter:blur(10px) saturate(140%);
    -webkit-backdrop-filter:blur(10px) saturate(140%);
  }
  [data-theme="dark"] .chip {
    background:var(--glass-bg);
    border-color:var(--glass-border);
    box-shadow:var(--glass-shadow);
  }
  .chip:hover {
    background:rgba(255,255,255,0.96);
    border-color:rgba(0,0,0,0.12);
    color:var(--text-1);
    transform:translateY(-2px);
    box-shadow:0 4px 12px rgba(0,0,0,0.1);
  }
  [data-theme="dark"] .chip:hover {
    background:rgba(255,255,255,0.9);
    border-color:var(--border-hover);
    box-shadow:var(--shadow-card-hover);
  }
  .chip .ci { flex-shrink:0; display:flex; transition:transform .2s cubic-bezier(.16,1,.3,1); }
  .chip:hover .ci { transform:translateY(-1px); }

  /* ── Chat input ── */
  .chat-box {
    background:var(--bg-surface);
    border:1px solid var(--border);
    border-radius:22px;
    transition:all .3s cubic-bezier(.16,1,.3,1);
    box-shadow:var(--shadow-card);
  }
  .chat-box:focus-within {
    border-color:var(--border-hover);
    background:var(--bg-surface);
    box-shadow:var(--shadow-card-hover);
  }
  .chat-box textarea {
    background:transparent; border:none; outline:none;
    color:var(--text-1); font-size:15px; line-height:1.65; resize:none;
    font-family:inherit; width:100%; padding:0;
    max-height:180px; overflow-y:auto;
  }
  .chat-box textarea::placeholder { color:var(--text-3); }

  /* ── Hero chat box ── */
  .chat-box-hero {
    background:var(--glass-bg);
    border:1px solid var(--glass-border);
    border-radius:24px;
    transition:border-color .3s cubic-bezier(.16,1,.3,1), box-shadow .3s cubic-bezier(.16,1,.3,1), background .3s;
    box-shadow:var(--glass-shadow);
    backdrop-filter:blur(20px) saturate(160%);
    -webkit-backdrop-filter:blur(20px) saturate(160%);
    animation:inputReveal .62s cubic-bezier(.16,1,.3,1) .22s both;
  }
  .chat-box-hero:focus-within {
    border-color:rgba(0,0,0,0.12);
    background:rgba(255,255,255,0.96);
    box-shadow:var(--shadow-card-hover);
  }
  .chat-box-hero textarea {
    background:transparent; border:none; outline:none;
    color:var(--text-1); font-size:16px; line-height:1.7; resize:none;
    font-family:inherit; width:100%; padding:0;
    max-height:200px; overflow-y:auto;
  }
  .chat-box-hero textarea::placeholder { color:var(--text-3); font-size:16px; }

  /* ── Send button ── */
  .send-btn {
    width:42px; height:42px; border-radius:13px;
    background:#111111;
    border:none; display:flex; align-items:center; justify-content:center;
    cursor:pointer; flex-shrink:0;
    transition:all .15s;
  }
  .send-btn-hero {
    width:48px; height:48px; border-radius:15px;
    background:#111111;
    border:none; display:flex; align-items:center; justify-content:center;
    cursor:pointer; flex-shrink:0;
    transition:all .15s;
  }
  .send-btn:hover:not(:disabled), .send-btn-hero:hover:not(:disabled) {
    transform:translateY(-1px) scale(1.04);
    background:#333333;
  }
  .send-btn:active:not(:disabled), .send-btn-hero:active:not(:disabled) { transform:scale(.95); }
  .send-btn:disabled, .send-btn-hero:disabled { opacity:.26; cursor:not-allowed; }

  /* ── Bubbles ── */
  .msg-user {
    background:var(--accent-soft);
    border:1px solid var(--accent-border);
    border-radius:20px 20px 5px 20px;
    box-shadow:var(--shadow-row);
  }
  .msg-ai {
    background:var(--bg-surface-2);
    border:1px solid var(--border);
    border-radius:20px 20px 20px 5px;
  }

  /* ── Float cards ── */
  .float-card {
    position:absolute;
    display:flex; align-items:center; gap:9px;
    padding:8px 13px;
    background:var(--glass-bg);
    border:1px solid var(--glass-border);
    border-radius:12px;
    white-space:nowrap; pointer-events:none; opacity:0;
    box-shadow:var(--glass-shadow);
    backdrop-filter:blur(var(--glass-blur)) saturate(150%);
    -webkit-backdrop-filter:blur(var(--glass-blur)) saturate(150%);
  }

  /* ── Status pill ── */
  .status-pill {
    display:inline-flex; align-items:center; gap:10px;
    padding:6px 16px 6px 10px; border-radius:100px;
    background:var(--glass-bg);
    border:1px solid var(--glass-border);
    box-shadow:var(--glass-shadow);
    backdrop-filter:blur(8px) saturate(130%);
    -webkit-backdrop-filter:blur(8px) saturate(130%);
  }

  /* ── Scrollbar ── */
  .chat-scroll::-webkit-scrollbar { width:3px; }
  .chat-scroll::-webkit-scrollbar-track { background:transparent; }
  .chat-scroll::-webkit-scrollbar-thumb { background:var(--bg-surface-2); border-radius:2px; }

  /* ── Aurora layers — subtle in light, full in dark ── */
  .aurora-l1 {
    position:absolute; top:-28%; left:10%; width:900px; height:800px; border-radius:50%;
    background:radial-gradient(ellipse,rgba(124,92,252,0.14) 0%,rgba(124,92,252,0.06) 45%,transparent 70%);
    animation:auroraA 22s ease-in-out infinite; filter:blur(55px);
  }
  [data-theme="dark"] .aurora-l1 {
    background:radial-gradient(ellipse,rgba(161,117,252,0.52) 0%,rgba(124,58,237,0.26) 38%,rgba(109,40,217,0.08) 60%,transparent 72%);
  }
  .aurora-l4 {
    position:absolute; top:2%; left:2%; width:380px; height:380px; border-radius:50%;
    background:radial-gradient(ellipse,rgba(124,92,252,0.10) 0%,transparent 72%);
    animation:auroraD 19s ease-in-out infinite; filter:blur(42px);
  }
  [data-theme="dark"] .aurora-l4 {
    background:radial-gradient(ellipse,rgba(139,92,246,0.48) 0%,rgba(109,40,217,0.18) 50%,transparent 72%);
  }
  .aurora-l5 {
    position:absolute; bottom:-8%; right:4%; width:580px; height:480px; border-radius:50%;
    background:radial-gradient(ellipse,rgba(99,102,241,0.09) 0%,rgba(124,92,252,0.04) 50%,transparent 72%);
    animation:auroraB 28s ease-in-out infinite; filter:blur(60px);
  }
  [data-theme="dark"] .aurora-l5 { opacity:0; }
  .aurora-grid {
    position:absolute; inset:0;
    background-image:linear-gradient(rgba(15,23,42,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(15,23,42,0.04) 1px,transparent 1px);
    background-size:72px 72px;
    mask-image:radial-gradient(ellipse 90% 85% at 50% 22%,black 25%,transparent 100%);
    -webkit-mask-image:radial-gradient(ellipse 90% 85% at 50% 22%,black 25%,transparent 100%);
  }
  [data-theme="dark"] .aurora-grid {
    background-image:linear-gradient(rgba(255,255,255,0.016) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.016) 1px,transparent 1px);
  }
  .aurora-vignette { position:absolute; inset:0; }
  [data-theme="dark"] .aurora-vignette {
    background:radial-gradient(ellipse 115% 105% at 50% 50%,transparent 30%,rgba(28,15,54,0.55) 75%,rgba(28,15,54,0.9) 100%);
  }
  .bottom-fade {
    background:linear-gradient(to top,var(--bg-page) 52%,transparent 100%);
  }
  [data-theme="dark"] .bottom-fade {
    background:linear-gradient(to top,#1C0F36 52%,rgba(28,15,54,0.88) 80%,transparent 100%);
  }
`


function FloatCard({ label, value, icon, delay, duration, left }) {
  return (
    <div className="float-card" style={{ left, bottom: '2%', animation: `floatUp ${duration}s ease-in-out ${delay}s infinite`, zIndex: 0 }}>
      <span style={{ color: 'var(--text-3)', display: 'flex' }}>{FLOAT_ICON[icon]}</span>
      <span style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 11, color: 'var(--text-1)', fontWeight: 700, marginLeft: 2 }}>{value}</span>
    </div>
  )
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '3px 0' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--text-3)',
          animation: `dotBounce 1.2s ease-in-out ${i * 0.18}s infinite`,
        }} />
      ))}
    </div>
  )
}

function LynqBadge() {
  return (
    <div style={{
      width: 30, height: 30, borderRadius: 9,
      background: 'linear-gradient(135deg,#A175FC 0%,#7C3AED 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      boxShadow: '0 2px 8px rgba(161,117,252,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
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
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 14, animation: 'msgIn .3s cubic-bezier(.16,1,.3,1) both' }}>
      {!isUser && <div style={{ marginRight: 10, marginTop: 2, flexShrink: 0 }}><LynqBadge /></div>}
      <div className={isUser ? 'msg-user' : 'msg-ai'} style={{ maxWidth: '72%', padding: '13px 17px', fontSize: 14, lineHeight: 1.72, color: isUser ? 'var(--text-1)' : 'var(--text-1)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {isStreaming && !content ? <TypingDots /> : content}
        {isStreaming && content && (
          <span style={{ display: 'inline-block', width: 2, height: 14, background: 'var(--text-2)', marginLeft: 2, verticalAlign: 'text-bottom', animation: 'blink 1s ease-in-out infinite' }} />
        )}
      </div>
    </div>
  )
}

export default function HomePage() {
  const [session, setSession]             = useState(null)
  const [userName, setUserName]           = useState('')
  const [messages, setMessages]           = useState([])
  const [input, setInput]                 = useState('')
  const [isLoading, setIsLoading]         = useState(false)
  const [storeContext, setStoreContext]    = useState(null)
  const [contextLoaded, setContextLoaded] = useState(false)
  const [mounted, setMounted]             = useState(false)
  const messagesEndRef = useRef(null)
  const heroInputRef   = useRef(null)
  const bottomInputRef = useRef(null)
  const greeting       = getGreeting()

  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return }
      setSession(session)
      const meta = session.user.user_metadata || {}
      const raw  = (session.user.email || '').split('@')[0]
      setUserName(meta.full_name || meta.name || (raw.charAt(0).toUpperCase() + raw.slice(1)))
      loadContext(session.access_token)
    })
  }, [])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadContext(token) {
    const h = { Authorization: `Bearer ${token}` }
    try {
      const [a, b, c] = await Promise.all([
        fetch('/api/shopify/kpis',    { headers: h }),
        fetch('/api/shopify/orders',  { headers: h }),
        fetch('/api/shopify/refunds', { headers: h }),
      ])
      const kpis             = a.ok ? await a.json() : {}
      const { orders  = [] } = b.ok ? await b.json() : {}
      const { refunds = [] } = c.ok ? await c.json() : {}
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
      // Snapshot history before adding the new streaming message.
      // Filter out streaming placeholders; pass only completed turns.
      const history = messages.filter(m => !m.isStreaming).map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ message: t, history, context: storeContext }),
      })
      if (!res.ok || !res.body) throw new Error()
      const reader = res.body.getReader()
      const dec    = new TextDecoder()
      let acc = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += dec.decode(value, { stream: true })
        const snap = acc
        setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: snap, isStreaming: true }; return u })
      }
      setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: acc, isStreaming: false }; return u })
    } catch {
      setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: 'Something went wrong. Please try again.', isStreaming: false }; return u })
    } finally {
      setIsLoading(false)
      setTimeout(() => bottomInputRef.current?.focus(), 60)
    }
  }, [isLoading, session, storeContext])

  function onHeroKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }
  function onBottomKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  const hasMsg = messages.length > 0

  if (!mounted) return null

  return (
    <div className="h-root" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-page)' }}>
      <style>{CSS}</style>
      <Sidebar />

      <div style={{ marginLeft: 208, flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', minHeight: '100vh', background: 'transparent', minWidth: 0 }}>

        {/* ── 5-layer aurora ── */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>

          {/* Layer 1 — brand purple bloom (subtle light, full dark) */}
          <div className="aurora-l1" />
          {/* Layer 4 — violet accent top-left */}
          <div className="aurora-l4" />
          {/* Layer 5 — indigo bottom-right (light only) */}
          <div className="aurora-l5" />

          {/* Dot grid (dark dots in light, white lines in dark) */}
          <div className="aurora-grid" />

          {/* Edge vignette (none in light, dark in dark mode) */}
          <div className="aurora-vignette" />

          {/* Ambient float cards */}
          {FLOAT_ITEMS.map(item => <FloatCard key={item.label} {...item} />)}
        </div>

        {/* ── HERO STATE (no messages) ── */}
        {!hasMsg && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 44px 40px', position: 'relative', zIndex: 1, isolation: 'isolate', willChange: 'transform' }}>
            <div style={{ width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>

              {/* Status pill */}
              <div className="status-pill" style={{ marginBottom: 28, animation: 'revealUp .5s cubic-bezier(.16,1,.3,1) both' }}>
                <div style={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80' }} />
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#4ade80', animation: 'liveBlip 2.4s ease-in-out infinite' }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-2)' }}>
                  {contextLoaded ? greeting : 'Connecting…'}
                </span>
              </div>

              {/* Heading */}
              <h1 style={{ fontSize: 'clamp(36px,5.2vw,60px)', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.07, color: 'var(--text-1)', marginBottom: 14, animation: 'revealUp .58s cubic-bezier(.16,1,.3,1) .07s both' }}>
                Welcome back,{' '}
                <span style={{
                  background: 'linear-gradient(120deg,#A175FC 0%,#9B6FFF 40%,#7C3AED 100%)',
                  backgroundSize: '200% auto',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                  animation: 'shimmer 10s ease-in-out infinite',
                  display: 'inline',
                }}>
                  {userName || 'there'}
                </span>
              </h1>

              {/* Subtitle */}
              <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.8, maxWidth: 340, marginBottom: 36, fontWeight: 400, animation: 'revealUp .58s cubic-bezier(.16,1,.3,1) .14s both' }}>
                {contextLoaded
                  ? 'Ask anything about your store — revenue, refunds, orders, trends.'
                  : 'Connecting to your store data…'}
              </p>


              {/* ── HERO CHAT INPUT ── */}
              <div style={{ width: '100%' }}>
                <div className="chat-box-hero" style={{ padding: '20px 20px 20px 24px', display: 'flex', alignItems: 'flex-end', gap: 14 }}>
                  <textarea
                    ref={heroInputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={onHeroKey}
                    placeholder={contextLoaded ? 'Ask anything about your store…' : 'Connecting to your store…'}
                    disabled={!contextLoaded || isLoading}
                    rows={1}
                    onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px' }}
                  />
                  <button className="send-btn-hero" onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading || !contextLoaded} aria-label="Send message">
                    {isLoading
                      ? <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.22)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                      : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    }
                  </button>
                </div>

                {/* Suggestion chips — below the input */}
                {contextLoaded && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center', marginTop: 14, animation: 'revealUp .58s cubic-bezier(.16,1,.3,1) .32s both' }}>
                    {SUGGESTIONS.map(({ text, icon, color }, i) => (
                      <button
                        key={text}
                        className="chip"
                        onClick={() => sendMessage(text)}
                        disabled={isLoading}
                        style={{ animation: `chipReveal .42s cubic-bezier(.16,1,.3,1) ${.36 + i * .055}s both` }}
                      >
                        <span className="ci" style={{ color }}>{icon}</span>
                        {text}
                      </button>
                    ))}
                  </div>
                )}

                <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: 'var(--text-3)', letterSpacing: '.04em' }}>
                  Lynq AI · Answers based on live store data · ↵ Enter to send
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ── CONVERSATION STATE (has messages) ── */}
        {hasMsg && (
          <>
            {/* Scrollable messages */}
            <div className="chat-scroll" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 44px 16px', position: 'relative', zIndex: 1 }}>
              <div style={{ width: '100%', maxWidth: 780 }}>
                {messages.map((msg, i) => <ChatMessage key={i} {...msg} />)}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Bottom input */}
            <div className="bottom-fade" style={{ padding: '16px 44px 36px', display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
              <div style={{ width: '100%', maxWidth: 780 }}>
                <div className="chat-box" style={{ padding: '18px 18px 18px 22px', display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                  <textarea
                    ref={bottomInputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={onBottomKey}
                    placeholder="Ask a follow-up…"
                    disabled={isLoading}
                    rows={1}
                    onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px' }}
                  />
                  <button className="send-btn" onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading} aria-label="Send message">
                    {isLoading
                      ? <div style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.22)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    }
                  </button>
                </div>
                <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: 'var(--text-3)', letterSpacing: '.04em' }}>
                  Lynq AI · Answers based on live store data · ↵ Enter to send
                </div>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
