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
  'Top refunded products this month',
  'What is my revenue this month?',
  'Which orders are still unfulfilled?',
  "What's my refund rate trend?",
]

const CSS = `
  @keyframes pulseGreen {
    0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4) }
    50%       { box-shadow: 0 0 0 8px rgba(34,197,94,0) }
  }
  @keyframes borderPulse {
    0%, 100% { opacity: 0.4 }
    50%       { opacity: 0.9 }
  }
  @keyframes spin  { to { transform: rotate(360deg); } }
  @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }
  @keyframes dotBounce {
    0%,60%,100% { transform:translateY(0);    opacity:.35; }
    30%          { transform:translateY(-5px); opacity:1;   }
  }
  @keyframes msgIn {
    from { opacity:0; transform:translateY(10px) scale(.98); }
    to   { opacity:1; transform:translateY(0)    scale(1);   }
  }
  @keyframes toastIn {
    from { opacity:0; transform:translateX(-20px); }
    to   { opacity:1; transform:translateX(0); }
  }

  @media (prefers-reduced-motion:reduce) {
    *, *::before, *::after { animation-duration:.01ms !important; transition-duration:.01ms !important; }
  }

  .h-root { font-family:'Switzer',-apple-system,BlinkMacSystemFont,sans-serif; -webkit-font-smoothing:antialiased; }
  .h-root * { box-sizing:border-box; margin:0; padding:0; }

  .chat-scroll::-webkit-scrollbar       { width:3px; }
  .chat-scroll::-webkit-scrollbar-track { background:transparent; }
  .chat-scroll::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.1); border-radius:2px; }

  .msg-user {
    background:rgba(139,92,246,0.08);
    border:1px solid rgba(139,92,246,0.15);
    border-radius:20px 20px 5px 20px;
    padding:13px 17px; max-width:72%;
    font-size:14px; line-height:1.72; color:#0F0F10;
    white-space:pre-wrap; word-break:break-word;
  }
  .msg-ai {
    background:#FFFFFF;
    border:1px solid rgba(0,0,0,0.07);
    border-radius:20px 20px 20px 5px;
    padding:13px 17px; max-width:72%;
    font-size:14px; line-height:1.72; color:#0F0F10;
    white-space:pre-wrap; word-break:break-word;
  }

  .send-btn {
    width:34px; height:34px; border-radius:8px;
    background:#111111; border:none;
    display:flex; align-items:center; justify-content:center;
    cursor:pointer; flex-shrink:0; transition:background .15s ease;
  }
  .send-btn:hover:not(:disabled) { background:#333333 !important; }
  .send-btn:disabled              { opacity:.26; cursor:not-allowed; }

  .send-btn-lg {
    width:42px; height:42px; border-radius:10px;
    background:#0F0F10; border:none;
    display:flex; align-items:center; justify-content:center;
    cursor:pointer; flex-shrink:0; transition:background .15s ease;
  }
  .send-btn-lg:hover:not(:disabled) { background:#1a1a1a !important; }
  .send-btn-lg:disabled              { opacity:.26; cursor:not-allowed; }

  .chat-bottom {
    background:#FFFFFF;
    border:1px solid rgba(0,0,0,0.08);
    border-radius:14px;
    padding:14px 14px 14px 18px;
    display:flex; align-items:flex-end; gap:12px;
    box-shadow:0 2px 12px rgba(0,0,0,0.06);
    transition:border-color .2s, box-shadow .2s;
  }
  .chat-bottom:focus-within {
    border-color:rgba(0,0,0,0.14);
    box-shadow:0 4px 20px rgba(0,0,0,0.08);
  }
  .chat-bottom textarea {
    background:transparent; border:none; outline:none;
    color:#0F0F10; font-size:14px; line-height:1.65; resize:none;
    font-family:inherit; width:100%; padding:0;
    max-height:180px; overflow-y:auto;
  }
  .chat-bottom textarea::placeholder { color:#9CA3AF; }

  .search-input {
    font-size:14px; color:#111111; border:none; outline:none;
    flex:1; background:transparent;
    font-family:'Switzer',-apple-system,BlinkMacSystemFont,sans-serif;
  }
  .search-input::placeholder { color:#BDBDBD; }

  .chip-btn {
    background:rgba(255,255,255,0.8);
    backdrop-filter:blur(10px);
    -webkit-backdrop-filter:blur(10px);
    border:1px solid rgba(0,0,0,0.08);
    border-radius:20px;
    padding:7px 14px;
    font-size:12px; font-weight:500; color:#555555;
    cursor:pointer;
    box-shadow:0 1px 3px rgba(0,0,0,0.05);
    transition:all 0.15s ease;
    font-family:inherit;
  }
  .chip-btn:hover:not(:disabled) {
    transform:translateY(-2px);
    box-shadow:0 4px 16px rgba(139,92,246,0.12);
    border-color:rgba(139,92,246,0.2);
  }
  .chip-btn:disabled { opacity:.5; cursor:not-allowed; }
`

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '3px 0' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#9CA3AF', animation: `dotBounce 1.2s ease-in-out ${i * 0.18}s infinite` }} />
      ))}
    </div>
  )
}

function LynqBadge() {
  return (
    <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg,#A175FC 0%,#7C3AED 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(161,117,252,0.4)' }}>
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
      <div className={isUser ? 'msg-user' : 'msg-ai'}>
        {isStreaming && !content ? <TypingDots /> : content}
        {isStreaming && content && (
          <span style={{ display: 'inline-block', width: 2, height: 14, background: '#6B7280', marginLeft: 2, verticalAlign: 'text-bottom', animation: 'blink 1s ease-in-out infinite' }} />
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [session, setSession]             = useState(null)
  const [userName, setUserName]           = useState('')
  const [messages, setMessages]           = useState([])
  const [input, setInput]                 = useState('')
  const [isLoading, setIsLoading]         = useState(false)
  const [storeContext, setStoreContext]    = useState(null)
  const [contextLoaded, setContextLoaded] = useState(false)
  const [mounted, setMounted]             = useState(false)
  const [showToast, setShowToast]         = useState(false)
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
    const t = setTimeout(() => setShowToast(true), 1800)
    return () => clearTimeout(t)
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
  }, [isLoading, session, storeContext, messages])

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  const hasMsg = messages.length > 0

  if (!mounted) return null

  return (
    <div className="h-root" style={{ display: 'flex', minHeight: '100vh', background: '#F5F4FF' }}>
      <style>{CSS}</style>
      <Sidebar />

      <div style={{ flex: 1, minHeight: '100vh', background: '#F5F4FF', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* ── 4 CSS orbs ── */}
        <div style={{ position: 'absolute', top: -200, right: -100, width: 800, height: 800, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.35), transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0, animation: 'orbFloat1 18s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: -200, left: -100, width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.25), transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0, animation: 'orbFloat2 22s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: '20%', left: '5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.18), transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0, animation: 'orbFloat3 15s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '10%', right: '5%', width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.15), transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0, animation: 'orbFloat4 19s ease-in-out infinite' }} />

        {/* ── HERO STATE ── */}
        {!hasMsg && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1, padding: '40px 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 24px', maxWidth: 640, width: '100%' }}>

              {/* Badge */}
              <div className="home-content-item">
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 20, padding: '5px 14px', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', animation: 'pulseGreen 2s ease-in-out infinite', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#555555', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {greeting}
                  </span>
                </div>
              </div>

              {/* Headline */}
              <h1 className="home-content-item" style={{ fontSize: 42, fontWeight: 800, color: '#0F0F10', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 12 }}>
                Welcome back,{' '}
                <span style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 50%, #3B82F6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', display: 'inline-block' }}>
                  {userName || 'there'}
                </span>
              </h1>

              {/* Subtitle */}
              <p className="home-content-item" style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.6, marginBottom: 32, maxWidth: 420 }}>
                {contextLoaded
                  ? 'Ask anything about your store — revenue, refunds, orders, trends.'
                  : 'Connecting to your store data…'}
              </p>

              {/* Search bar */}
              <div className="home-content-item" style={{ width: '100%' }}>
                <div style={{ position: 'relative', width: 'min(520px, 90vw)', margin: '0 auto 20px' }}>
                  <div style={{ position: 'absolute', top: -1.5, right: -1.5, bottom: -1.5, left: -1.5, borderRadius: 14, background: 'linear-gradient(135deg, rgba(139,92,246,0.5), rgba(99,102,241,0.3), rgba(96,165,250,0.4))', zIndex: 0, animation: 'borderPulse 3.5s ease-in-out infinite' }} />
                  <div style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 1 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#BDBDBD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input
                      ref={heroInputRef}
                      className="search-input"
                      type="text"
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={onKey}
                      placeholder={contextLoaded ? 'Ask anything about your store…' : 'Connecting…'}
                      disabled={!contextLoaded || isLoading}
                    />
                    <button className="send-btn" onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading || !contextLoaded} aria-label="Send">
                      {isLoading
                        ? <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                      }
                    </button>
                  </div>
                </div>
              </div>

              {/* Chips */}
              <div className="home-content-item" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {SUGGESTIONS.map(text => (
                  <button key={text} className="chip-btn" onClick={() => sendMessage(text)} disabled={isLoading || !contextLoaded}>
                    {text}
                  </button>
                ))}
              </div>

              {/* Footer */}
              <div style={{ fontSize: 11, color: '#BDBDBD', marginTop: 16, textAlign: 'center' }}>
                Lynq AI · Answers based on live store data · ↵ Enter to send
              </div>

            </div>
          </div>
        )}

        {/* ── CONVERSATION STATE ── */}
        {hasMsg && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
            <div className="chat-scroll" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 44px 16px' }}>
              <div style={{ width: '100%', maxWidth: 780 }}>
                {messages.map((msg, i) => <ChatMessage key={i} {...msg} />)}
                <div ref={messagesEndRef} />
              </div>
            </div>
            <div style={{ padding: '16px 44px 36px', display: 'flex', justifyContent: 'center', background: 'linear-gradient(to top, #F9F9FB 52%, transparent 100%)' }}>
              <div style={{ width: '100%', maxWidth: 780 }}>
                <div className="chat-bottom">
                  <textarea
                    ref={bottomInputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={onKey}
                    placeholder="Ask a follow-up…"
                    disabled={isLoading}
                    rows={1}
                    onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px' }}
                  />
                  <button className="send-btn-lg" onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading} aria-label="Send">
                    {isLoading
                      ? <div style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.22)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    }
                  </button>
                </div>
                <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: '#BDBDBD' }}>
                  Lynq AI · Answers based on live store data · ↵ Enter to send
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── Toast ── */}
      {showToast && (
        <div style={{ position: 'fixed', bottom: 20, left: 236, background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', zIndex: 100, animation: 'toastIn 0.3s ease forwards' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#111111' }}>New order</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0F0F10' }}>€129.00</span>
          <button onClick={() => setShowToast(false)} style={{ marginLeft: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
        </div>
      )}

    </div>
  )
}
